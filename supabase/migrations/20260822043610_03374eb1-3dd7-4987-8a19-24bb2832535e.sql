-- ============ enums ============
DO $$ BEGIN
  CREATE TYPE public.leave_status AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ leave types ============
CREATE TABLE public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  annual_quota numeric(5,1) NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leave_types TO authenticated;
GRANT INSERT, UPDATE ON public.leave_types TO authenticated;
GRANT ALL ON public.leave_types TO service_role;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY leave_types_select_authenticated ON public.leave_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY leave_types_insert_admin ON public.leave_types
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY leave_types_update_admin ON public.leave_types
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER leave_types_updated_at BEFORE UPDATE ON public.leave_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.leave_types (code, name, annual_quota, is_paid) VALUES
  ('ANNUAL', 'Annual leave', 18, true),
  ('SICK', 'Sick leave', 12, true),
  ('CASUAL', 'Casual leave', 6, true),
  ('UNPAID', 'Unpaid leave', 0, false);

-- ============ leave requests ============
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric(5,1) NOT NULL DEFAULT 0,
  reason text,
  status public.leave_status NOT NULL DEFAULT 'PENDING',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leave_requests_employee_idx ON public.leave_requests (employee_id, start_date DESC);
CREATE INDEX leave_requests_status_idx ON public.leave_requests (status, start_date DESC);

GRANT SELECT, INSERT, UPDATE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY leave_requests_select_own_or_admin ON public.leave_requests
  FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());

CREATE POLICY leave_requests_insert_own ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() AND status = 'PENDING');

-- Employees may only cancel their own still-pending request; admins may decide any.
CREATE POLICY leave_requests_update_own_cancel ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (employee_id = public.current_employee_id() AND status = 'PENDING')
  WITH CHECK (employee_id = public.current_employee_id() AND status IN ('PENDING','CANCELLED'));

CREATE POLICY leave_requests_update_admin ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  category text NOT NULL DEFAULT 'GENERAL',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _title text, _body text, _category text, _link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, title, body, category, link)
  VALUES (_user_id, _title, _body, coalesce(_category,'GENERAL'), _link);
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM public, anon;

-- ============ leave helpers ============
-- Working days between two dates, weekends excluded.
CREATE OR REPLACE FUNCTION public.leave_working_days(_start date, _end date)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT COALESCE(count(*), 0)::numeric
  FROM generate_series(_start, _end, interval '1 day') d
  WHERE EXTRACT(ISODOW FROM d) < 6;
$$;

CREATE OR REPLACE FUNCTION public.leave_balance(_employee_id uuid, _year integer DEFAULT NULL)
RETURNS TABLE (
  leave_type_id uuid, code text, name text, annual_quota numeric,
  used_days numeric, pending_days numeric, remaining_days numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_year integer; v_owner uuid;
BEGIN
  v_year := COALESCE(_year, EXTRACT(YEAR FROM public.business_today())::int);
  SELECT e.user_id INTO v_owner FROM public.employees e WHERE e.id = _employee_id;
  IF NOT (public.is_admin() OR v_owner = auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  RETURN QUERY
  SELECT t.id, t.code, t.name, t.annual_quota,
    COALESCE(SUM(CASE WHEN r.status = 'APPROVED' THEN r.days END), 0)::numeric,
    COALESCE(SUM(CASE WHEN r.status = 'PENDING' THEN r.days END), 0)::numeric,
    GREATEST(t.annual_quota
      - COALESCE(SUM(CASE WHEN r.status IN ('APPROVED','PENDING') THEN r.days END), 0), 0)::numeric
  FROM public.leave_types t
  LEFT JOIN public.leave_requests r
    ON r.leave_type_id = t.id
   AND r.employee_id = _employee_id
   AND EXTRACT(YEAR FROM r.start_date)::int = v_year
  WHERE t.is_active
  GROUP BY t.id, t.code, t.name, t.annual_quota, t.created_at
  ORDER BY t.created_at;
END; $$;
REVOKE EXECUTE ON FUNCTION public.leave_balance(uuid, integer) FROM public, anon;

-- Submit a request as the signed-in employee. Server-side validation of dates,
-- overlaps and remaining allowance so the client cannot bypass the rules.
CREATE OR REPLACE FUNCTION public.leave_submit(
  _leave_type_id uuid, _start date, _end date, _reason text
) RETURNS public.leave_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_employee uuid; v_days numeric; v_type public.leave_types; v_row public.leave_requests;
  v_remaining numeric;
BEGIN
  v_employee := public.current_employee_id();
  IF v_employee IS NULL THEN RAISE EXCEPTION 'NO_EMPLOYEE_RECORD'; END IF;
  IF _start IS NULL OR _end IS NULL THEN RAISE EXCEPTION 'INVALID_RANGE'; END IF;
  IF _end < _start THEN RAISE EXCEPTION 'INVALID_RANGE'; END IF;
  IF _end - _start > 90 THEN RAISE EXCEPTION 'RANGE_TOO_LONG'; END IF;

  SELECT * INTO v_type FROM public.leave_types WHERE id = _leave_type_id AND is_active;
  IF v_type.id IS NULL THEN RAISE EXCEPTION 'UNKNOWN_LEAVE_TYPE'; END IF;

  v_days := public.leave_working_days(_start, _end);
  IF v_days <= 0 THEN RAISE EXCEPTION 'NO_WORKING_DAYS'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.leave_requests r
    WHERE r.employee_id = v_employee
      AND r.status IN ('PENDING','APPROVED')
      AND r.start_date <= _end AND r.end_date >= _start
  ) THEN RAISE EXCEPTION 'OVERLAPPING_REQUEST'; END IF;

  IF v_type.annual_quota > 0 THEN
    SELECT b.remaining_days INTO v_remaining
    FROM public.leave_balance(v_employee) b WHERE b.leave_type_id = v_type.id;
    IF COALESCE(v_remaining, 0) < v_days THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  END IF;

  INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date, days, reason)
  VALUES (v_employee, v_type.id, _start, _end, v_days,
          NULLIF(btrim(coalesce(_reason,'')), ''))
  RETURNING * INTO v_row;

  RETURN v_row;
END; $$;
REVOKE EXECUTE ON FUNCTION public.leave_submit(uuid, date, date, text) FROM public, anon;

-- Admin decision. Notifies the employee in-app.
CREATE OR REPLACE FUNCTION public.leave_review(
  _id uuid, _decision public.leave_status, _comment text
) RETURNS public.leave_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_row public.leave_requests; v_user uuid; v_type text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _decision NOT IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;

  UPDATE public.leave_requests
    SET status = _decision,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_comment = NULLIF(btrim(coalesce(_comment,'')), '')
    WHERE id = _id AND status = 'PENDING'
    RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;

  SELECT e.user_id INTO v_user FROM public.employees e WHERE e.id = v_row.employee_id;
  SELECT t.name INTO v_type FROM public.leave_types t WHERE t.id = v_row.leave_type_id;

  PERFORM public.notify_user(
    v_user,
    CASE WHEN _decision = 'APPROVED' THEN 'Leave approved' ELSE 'Leave rejected' END,
    format('%s from %s to %s (%s days) was %s.', v_type, v_row.start_date, v_row.end_date,
           trim(to_char(v_row.days, 'FM990.9')), lower(_decision::text)),
    'LEAVE', '/employee/leave');

  RETURN v_row;
END; $$;
REVOKE EXECUTE ON FUNCTION public.leave_review(uuid, public.leave_status, text) FROM public, anon;

-- Employee cancels their own pending request.
CREATE OR REPLACE FUNCTION public.leave_cancel(_id uuid) RETURNS public.leave_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_employee uuid; v_row public.leave_requests;
BEGIN
  v_employee := public.current_employee_id();
  IF v_employee IS NULL THEN RAISE EXCEPTION 'NO_EMPLOYEE_RECORD'; END IF;
  UPDATE public.leave_requests SET status = 'CANCELLED'
    WHERE id = _id AND employee_id = v_employee AND status = 'PENDING'
    RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;
  RETURN v_row;
END; $$;
REVOKE EXECUTE ON FUNCTION public.leave_cancel(uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.leave_working_days(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_balance(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_submit(uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_review(uuid, public.leave_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_cancel(uuid) TO authenticated;

-- ============ attendance notifications ============
CREATE OR REPLACE FUNCTION public.attendance_admin_update(
  _id uuid, _check_in timestamptz, _check_out timestamptz,
  _status public.attendance_status, _notes text
) RETURNS public.attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_row public.attendance; v_hours numeric; v_user uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _check_in IS NOT NULL AND _check_out IS NOT NULL AND _check_out < _check_in THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;

  v_hours := public.attendance_work_hours(_check_in, _check_out);

  UPDATE public.attendance
    SET check_in = _check_in,
        check_out = _check_out,
        status = _status,
        notes = COALESCE(NULLIF(btrim(coalesce(_notes,'')), ''), notes),
        work_hours = v_hours,
        extra_hours = public.attendance_extra_hours(v_hours)
    WHERE id = _id
    RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  SELECT e.user_id INTO v_user FROM public.employees e WHERE e.id = v_row.employee_id;
  PERFORM public.notify_user(
    v_user,
    'Attendance corrected',
    format('HR updated your attendance for %s. Status: %s, work hours: %s.',
           to_char(v_row.attendance_date, 'DD Mon YYYY'),
           lower(v_row.status::text),
           trim(to_char(v_row.work_hours, 'FM990.99'))),
    'ATTENDANCE', '/employee/attendance');

  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.attendance_check_in() RETURNS public.attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_employee uuid; v_date date; v_row public.attendance; v_user uuid;
BEGIN
  v_employee := public.current_employee_id();
  IF v_employee IS NULL THEN RAISE EXCEPTION 'NO_EMPLOYEE_RECORD'; END IF;
  v_date := public.business_today();

  SELECT * INTO v_row FROM public.attendance WHERE employee_id = v_employee AND attendance_date = v_date;
  IF v_row.id IS NOT NULL AND v_row.check_in IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_CHECKED_IN';
  END IF;

  IF v_row.id IS NULL THEN
    BEGIN
      INSERT INTO public.attendance (employee_id, attendance_date, check_in, status, work_hours, extra_hours)
      VALUES (v_employee, v_date, now(), 'PRESENT', 0, 0)
      RETURNING * INTO v_row;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_IN';
    END;
  ELSE
    UPDATE public.attendance
      SET check_in = now(), status = 'PRESENT', work_hours = 0, extra_hours = 0
      WHERE id = v_row.id
      RETURNING * INTO v_row;
  END IF;

  SELECT e.user_id INTO v_user FROM public.employees e WHERE e.id = v_employee;
  PERFORM public.notify_user(
    v_user, 'Checked in',
    format('You are marked present for %s.', to_char(v_row.attendance_date, 'DD Mon YYYY')),
    'ATTENDANCE', '/employee/attendance');

  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.attendance_check_out() RETURNS public.attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_employee uuid; v_date date; v_row public.attendance; v_hours numeric; v_user uuid;
BEGIN
  v_employee := public.current_employee_id();
  IF v_employee IS NULL THEN RAISE EXCEPTION 'NO_EMPLOYEE_RECORD'; END IF;
  v_date := public.business_today();

  SELECT * INTO v_row FROM public.attendance WHERE employee_id = v_employee AND attendance_date = v_date;
  IF v_row.id IS NULL OR v_row.check_in IS NULL THEN RAISE EXCEPTION 'NOT_CHECKED_IN'; END IF;
  IF v_row.check_out IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_CHECKED_OUT'; END IF;

  v_hours := public.attendance_work_hours(v_row.check_in, now());

  UPDATE public.attendance
    SET check_out = now(), work_hours = v_hours, extra_hours = public.attendance_extra_hours(v_hours)
    WHERE id = v_row.id
    RETURNING * INTO v_row;

  SELECT e.user_id INTO v_user FROM public.employees e WHERE e.id = v_employee;
  PERFORM public.notify_user(
    v_user, 'Checked out',
    format('Day closed for %s with %s work hours (%s extra).',
           to_char(v_row.attendance_date, 'DD Mon YYYY'),
           trim(to_char(v_row.work_hours, 'FM990.99')),
           trim(to_char(v_row.extra_hours, 'FM990.99'))),
    'ATTENDANCE', '/employee/attendance');

  RETURN v_row;
END; $$;