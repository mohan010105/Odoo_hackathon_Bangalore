-- 1. Leave types: description + attachment requirement
ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS requires_attachment boolean NOT NULL DEFAULT false;

-- 2. Leave requests: align field names with the Dayflow leave spec
ALTER TABLE public.leave_requests RENAME COLUMN days TO total_days;
ALTER TABLE public.leave_requests RENAME COLUMN reason TO remarks;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS attachment_url text;

-- 3. Leave allocations
CREATE TABLE IF NOT EXISTS public.leave_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id),
  allocated_days numeric NOT NULL DEFAULT 0 CHECK (allocated_days >= 0),
  used_days numeric NOT NULL DEFAULT 0 CHECK (used_days >= 0),
  remaining_days numeric GENERATED ALWAYS AS (GREATEST(allocated_days - used_days, 0)) STORED,
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_allocations_period CHECK (valid_to >= valid_from),
  CONSTRAINT leave_allocations_used_within CHECK (used_days <= allocated_days)
);

CREATE UNIQUE INDEX IF NOT EXISTS leave_allocations_unique_period
  ON public.leave_allocations (employee_id, leave_type_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS leave_allocations_employee_idx
  ON public.leave_allocations (employee_id);

GRANT SELECT ON public.leave_allocations TO authenticated;
GRANT ALL ON public.leave_allocations TO service_role;

ALTER TABLE public.leave_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_allocations_select_own_or_admin" ON public.leave_allocations
FOR SELECT TO authenticated
USING (public.is_admin() OR employee_id = public.current_employee_id());

CREATE POLICY "leave_allocations_insert_admin" ON public.leave_allocations
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "leave_allocations_update_admin" ON public.leave_allocations
FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS leave_allocations_updated_at ON public.leave_allocations;
CREATE TRIGGER leave_allocations_updated_at BEFORE UPDATE ON public.leave_allocations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Centralised day counting: inclusive calendar days
CREATE OR REPLACE FUNCTION public.leave_calendar_days(_start date, _end date)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _start IS NULL OR _end IS NULL OR _end < _start THEN 0::numeric
    ELSE ((_end - _start) + 1)::numeric
  END;
$$;

-- 5. Balance view based on allocations
DROP FUNCTION IF EXISTS public.leave_balance(uuid, integer);

CREATE OR REPLACE FUNCTION public.leave_balance(_employee_id uuid, _on_date date DEFAULT NULL)
RETURNS TABLE(
  allocation_id uuid,
  leave_type_id uuid,
  code text,
  name text,
  description text,
  is_paid boolean,
  requires_attachment boolean,
  allocated_days numeric,
  used_days numeric,
  pending_days numeric,
  remaining_days numeric,
  valid_from date,
  valid_to date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_date date;
BEGIN
  v_date := COALESCE(_on_date, public.business_today());
  SELECT e.user_id INTO v_owner FROM public.employees e WHERE e.id = _employee_id;
  IF NOT (public.is_admin() OR (v_owner IS NOT NULL AND v_owner = auth.uid())) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT a.id, t.id, t.code, t.name, t.description, t.is_paid, t.requires_attachment,
         a.allocated_days, a.used_days,
         COALESCE((
           SELECT SUM(r.total_days) FROM public.leave_requests r
           WHERE r.employee_id = a.employee_id
             AND r.leave_type_id = a.leave_type_id
             AND r.status = 'PENDING'
             AND r.start_date <= a.valid_to
             AND r.end_date >= a.valid_from
         ), 0)::numeric,
         a.remaining_days, a.valid_from, a.valid_to
  FROM public.leave_allocations a
  JOIN public.leave_types t ON t.id = a.leave_type_id
  WHERE a.employee_id = _employee_id
    AND t.is_active
    AND a.valid_from <= v_date
    AND a.valid_to >= v_date
  ORDER BY t.name;
END; $$;

-- 6. Submission with server-side validation
DROP FUNCTION IF EXISTS public.leave_submit(uuid, date, date, text);

CREATE OR REPLACE FUNCTION public.leave_submit(
  _leave_type_id uuid,
  _start date,
  _end date,
  _remarks text,
  _attachment_url text DEFAULT NULL
)
RETURNS public.leave_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_employee uuid; v_user uuid; v_days numeric;
  v_type public.leave_types; v_alloc public.leave_allocations; v_row public.leave_requests;
BEGIN
  v_employee := public.current_employee_id();
  IF v_employee IS NULL THEN RAISE EXCEPTION 'NO_EMPLOYEE_RECORD'; END IF;
  IF _start IS NULL OR _end IS NULL OR _end < _start THEN RAISE EXCEPTION 'INVALID_RANGE'; END IF;
  IF (_end - _start) > 90 THEN RAISE EXCEPTION 'RANGE_TOO_LONG'; END IF;

  SELECT * INTO v_type FROM public.leave_types WHERE id = _leave_type_id AND is_active;
  IF v_type.id IS NULL THEN RAISE EXCEPTION 'UNKNOWN_LEAVE_TYPE'; END IF;

  IF v_type.requires_attachment AND COALESCE(btrim(_attachment_url), '') = '' THEN
    RAISE EXCEPTION 'ATTACHMENT_REQUIRED';
  END IF;

  v_days := public.leave_calendar_days(_start, _end);
  IF v_days <= 0 THEN RAISE EXCEPTION 'INVALID_RANGE'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.leave_requests r
    WHERE r.employee_id = v_employee
      AND r.status IN ('PENDING','APPROVED')
      AND r.start_date <= _end AND r.end_date >= _start
  ) THEN RAISE EXCEPTION 'OVERLAPPING_REQUEST'; END IF;

  SELECT * INTO v_alloc FROM public.leave_allocations a
   WHERE a.employee_id = v_employee
     AND a.leave_type_id = v_type.id
     AND a.valid_from <= _start
     AND a.valid_to >= _end
   ORDER BY a.valid_from DESC LIMIT 1;

  IF v_alloc.id IS NULL THEN RAISE EXCEPTION 'NO_ALLOCATION'; END IF;

  IF v_alloc.remaining_days
     - COALESCE((
        SELECT SUM(r.total_days) FROM public.leave_requests r
        WHERE r.employee_id = v_employee AND r.leave_type_id = v_type.id
          AND r.status = 'PENDING'
          AND r.start_date <= v_alloc.valid_to AND r.end_date >= v_alloc.valid_from
     ), 0) < v_days THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  INSERT INTO public.leave_requests
    (employee_id, leave_type_id, start_date, end_date, total_days, remarks, attachment_url, status)
  VALUES (v_employee, v_type.id, _start, _end, v_days,
          NULLIF(btrim(coalesce(_remarks,'')), ''),
          NULLIF(btrim(coalesce(_attachment_url,'')), ''),
          'PENDING')
  RETURNING * INTO v_row;

  SELECT e.user_id INTO v_user FROM public.employees e WHERE e.id = v_employee;
  PERFORM public.notify_user(
    v_user, 'Leave request submitted',
    format('%s from %s to %s (%s days) is waiting for HR approval.',
           v_type.name, to_char(_start,'DD Mon YYYY'), to_char(_end,'DD Mon YYYY'),
           trim(to_char(v_days,'FM990.9'))),
    'LEAVE', '/employee/leave');

  -- notify every admin about the new request
  INSERT INTO public.notifications (user_id, title, body, category, link)
  SELECT ur.user_id, 'New leave request',
         format('%s requested %s from %s to %s.',
                (SELECT e.first_name || ' ' || e.last_name FROM public.employees e WHERE e.id = v_employee),
                v_type.name, to_char(_start,'DD Mon YYYY'), to_char(_end,'DD Mon YYYY')),
         'LEAVE', '/admin/leave'
  FROM public.user_roles ur WHERE ur.role = 'ADMIN'::public.app_role;

  RETURN v_row;
END; $$;

-- 7. Atomic approval / rejection
CREATE OR REPLACE FUNCTION public.leave_review(_id uuid, _decision leave_status, _comment text)
RETURNS public.leave_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.leave_requests; v_user uuid; v_type public.leave_types;
  v_alloc public.leave_allocations; v_day date;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _decision NOT IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  IF _decision = 'REJECTED' AND COALESCE(btrim(_comment), '') = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED';
  END IF;

  -- lock the row so two admins cannot process the same request
  SELECT * INTO v_row FROM public.leave_requests WHERE id = _id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_row.status <> 'PENDING' THEN RAISE EXCEPTION 'ALREADY_PROCESSED'; END IF;

  SELECT * INTO v_type FROM public.leave_types WHERE id = v_row.leave_type_id;

  IF _decision = 'APPROVED' THEN
    SELECT * INTO v_alloc FROM public.leave_allocations a
     WHERE a.employee_id = v_row.employee_id
       AND a.leave_type_id = v_row.leave_type_id
       AND a.valid_from <= v_row.start_date
       AND a.valid_to >= v_row.end_date
     ORDER BY a.valid_from DESC LIMIT 1
     FOR UPDATE;

    IF v_alloc.id IS NULL THEN RAISE EXCEPTION 'NO_ALLOCATION'; END IF;
    IF v_alloc.remaining_days < v_row.total_days THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

    IF EXISTS (
      SELECT 1 FROM public.leave_requests r
      WHERE r.employee_id = v_row.employee_id
        AND r.id <> v_row.id
        AND r.status = 'APPROVED'
        AND r.start_date <= v_row.end_date AND r.end_date >= v_row.start_date
    ) THEN RAISE EXCEPTION 'OVERLAPPING_REQUEST'; END IF;

    UPDATE public.leave_allocations
      SET used_days = used_days + v_row.total_days
      WHERE id = v_alloc.id;

    -- reflect approved leave in attendance without destroying existing records
    FOR v_day IN SELECT d::date FROM generate_series(v_row.start_date, v_row.end_date, interval '1 day') d
    LOOP
      INSERT INTO public.attendance (employee_id, attendance_date, status, work_hours, extra_hours, notes)
      VALUES (v_row.employee_id, v_day, 'LEAVE', 0, 0, format('Approved %s', v_type.name))
      ON CONFLICT (employee_id, attendance_date) DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.leave_requests
     SET status = _decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_comment = NULLIF(btrim(coalesce(_comment,'')), '')
   WHERE id = v_row.id AND status = 'PENDING'
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'ALREADY_PROCESSED'; END IF;

  SELECT e.user_id INTO v_user FROM public.employees e WHERE e.id = v_row.employee_id;
  PERFORM public.notify_user(
    v_user,
    CASE WHEN _decision = 'APPROVED' THEN 'Leave approved' ELSE 'Leave rejected' END,
    format('%s from %s to %s (%s days) was %s.%s',
           v_type.name, to_char(v_row.start_date,'DD Mon YYYY'), to_char(v_row.end_date,'DD Mon YYYY'),
           trim(to_char(v_row.total_days,'FM990.9')), lower(_decision::text),
           CASE WHEN v_row.review_comment IS NULL THEN '' ELSE ' Reason: ' || v_row.review_comment END),
    'LEAVE', '/employee/leave');

  RETURN v_row;
END; $$;

-- 8. Admin allocation management
CREATE OR REPLACE FUNCTION public.leave_allocation_upsert(
  _employee_id uuid,
  _leave_type_id uuid,
  _allocated_days numeric,
  _valid_from date,
  _valid_to date,
  _allocation_id uuid DEFAULT NULL
)
RETURNS public.leave_allocations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.leave_allocations;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _allocated_days IS NULL OR _allocated_days < 0 THEN RAISE EXCEPTION 'INVALID_DAYS'; END IF;
  IF _valid_from IS NULL OR _valid_to IS NULL OR _valid_to < _valid_from THEN
    RAISE EXCEPTION 'INVALID_PERIOD';
  END IF;

  IF _allocation_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.leave_allocations WHERE id = _allocation_id FOR UPDATE;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF _allocated_days < v_row.used_days THEN RAISE EXCEPTION 'BELOW_USED'; END IF;

    UPDATE public.leave_allocations
       SET allocated_days = _allocated_days, valid_from = _valid_from, valid_to = _valid_to
     WHERE id = v_row.id
     RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leave_allocations a
    WHERE a.employee_id = _employee_id AND a.leave_type_id = _leave_type_id
      AND a.valid_from <= _valid_to AND a.valid_to >= _valid_from
  ) THEN RAISE EXCEPTION 'DUPLICATE_ALLOCATION'; END IF;

  INSERT INTO public.leave_allocations
    (employee_id, leave_type_id, allocated_days, valid_from, valid_to)
  VALUES (_employee_id, _leave_type_id, _allocated_days, _valid_from, _valid_to)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

-- 9. Admin leave-type management (deactivate, never delete)
CREATE OR REPLACE FUNCTION public.leave_type_upsert(
  _code text,
  _name text,
  _description text,
  _requires_attachment boolean,
  _is_paid boolean,
  _is_active boolean,
  _id uuid DEFAULT NULL
)
RETURNS public.leave_types
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.leave_types; v_code text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  v_code := upper(btrim(coalesce(_code,'')));
  IF v_code = '' OR btrim(coalesce(_name,'')) = '' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;

  IF _id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.leave_types WHERE code = v_code AND id <> _id) THEN
      RAISE EXCEPTION 'DUPLICATE_CODE';
    END IF;
    UPDATE public.leave_types
       SET code = v_code, name = btrim(_name),
           description = NULLIF(btrim(coalesce(_description,'')), ''),
           requires_attachment = coalesce(_requires_attachment,false),
           is_paid = coalesce(_is_paid,true),
           is_active = coalesce(_is_active,true)
     WHERE id = _id
     RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    RETURN v_row;
  END IF;

  IF EXISTS (SELECT 1 FROM public.leave_types WHERE code = v_code) THEN
    RAISE EXCEPTION 'DUPLICATE_CODE';
  END IF;

  INSERT INTO public.leave_types (code, name, description, requires_attachment, is_paid, is_active)
  VALUES (v_code, btrim(_name), NULLIF(btrim(coalesce(_description,'')), ''),
          coalesce(_requires_attachment,false), coalesce(_is_paid,true), coalesce(_is_active,true))
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

-- 10. Private storage rules for leave certificates
CREATE POLICY "leave_docs_read_own_or_admin" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'leave-attachments'
  AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
);

CREATE POLICY "leave_docs_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'leave-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "leave_docs_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'leave-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "leave_docs_delete_own_or_admin" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'leave-attachments'
  AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
);
