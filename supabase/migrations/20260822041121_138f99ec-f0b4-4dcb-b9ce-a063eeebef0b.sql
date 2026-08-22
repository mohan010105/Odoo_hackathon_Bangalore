CREATE TYPE public.attendance_status AS ENUM ('PRESENT','ABSENT','HALF_DAY','LEAVE');

CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  work_hours numeric(6,2) NOT NULL DEFAULT 0,
  extra_hours numeric(6,2) NOT NULL DEFAULT 0,
  status public.attendance_status NOT NULL DEFAULT 'PRESENT',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_employee_date_unique UNIQUE (employee_id, attendance_date),
  CONSTRAINT attendance_order_check CHECK (check_out IS NULL OR check_in IS NULL OR check_out >= check_in),
  CONSTRAINT attendance_hours_check CHECK (work_hours >= 0 AND extra_hours >= 0)
);

CREATE INDEX attendance_date_idx ON public.attendance (attendance_date DESC);
CREATE INDEX attendance_employee_idx ON public.attendance (employee_id);

GRANT SELECT ON public.attendance TO authenticated;
GRANT INSERT, UPDATE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE POLICY attendance_select_own_or_admin ON public.attendance
FOR SELECT TO authenticated
USING (employee_id = public.current_employee_id() OR public.is_admin());

CREATE POLICY attendance_insert_admin ON public.attendance
FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY attendance_update_admin ON public.attendance
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Business timezone + centralized hour rules
CREATE OR REPLACE FUNCTION public.business_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date; $$;

CREATE OR REPLACE FUNCTION public.attendance_work_hours(_check_in timestamptz, _check_out timestamptz)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _check_in IS NULL OR _check_out IS NULL OR _check_out <= _check_in THEN 0::numeric
    ELSE round((EXTRACT(EPOCH FROM (_check_out - _check_in)) / 3600.0)::numeric, 2)
  END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_extra_hours(_work_hours numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT GREATEST(round(coalesce(_work_hours,0) - 8, 2), 0); $$;

-- Secure employee check-in: server resolves identity + timestamps
CREATE OR REPLACE FUNCTION public.attendance_check_in()
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee uuid; v_date date; v_row public.attendance;
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

  RETURN v_row;
END; $$;

-- Secure employee check-out
CREATE OR REPLACE FUNCTION public.attendance_check_out()
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee uuid; v_date date; v_row public.attendance; v_hours numeric;
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

  RETURN v_row;
END; $$;

-- Admin correction with recalculation and validation
CREATE OR REPLACE FUNCTION public.attendance_admin_update(
  _id uuid,
  _check_in timestamptz,
  _check_out timestamptz,
  _status public.attendance_status,
  _notes text
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.attendance; v_hours numeric;
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
  RETURN v_row;
END; $$;

REVOKE ALL ON FUNCTION public.attendance_admin_update(uuid, timestamptz, timestamptz, public.attendance_status, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.attendance_check_in() TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_check_out() TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_admin_update(uuid, timestamptz, timestamptz, public.attendance_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_today() TO authenticated;