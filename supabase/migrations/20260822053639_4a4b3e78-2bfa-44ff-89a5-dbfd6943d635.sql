CREATE TABLE public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  kind text NOT NULL,
  entity_label text NOT NULL,
  idempotency_key text NOT NULL,
  record_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX export_jobs_idempotency_key_uidx ON public.export_jobs (idempotency_key);
CREATE INDEX export_jobs_created_at_idx ON public.export_jobs (created_at DESC);

GRANT SELECT ON public.export_jobs TO authenticated;
GRANT ALL ON public.export_jobs TO service_role;

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY export_jobs_select_admin ON public.export_jobs
  FOR SELECT TO authenticated USING (public.is_admin());

-- Claims an export exactly once. Returns true when this call is the first for
-- the given key (so the caller should log/notify), false for a duplicate click
-- or a retry of the same download.
CREATE OR REPLACE FUNCTION public.export_job_claim(
  _kind text,
  _entity_label text,
  _idempotency_key text,
  _record_count integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(btrim(_idempotency_key), '') = '' THEN RAISE EXCEPTION 'INVALID_KEY'; END IF;

  INSERT INTO public.export_jobs (actor_id, kind, entity_label, idempotency_key, record_count)
  VALUES (auth.uid(), upper(btrim(_kind)), btrim(coalesce(_entity_label, '')),
          btrim(_idempotency_key), GREATEST(coalesce(_record_count, 0), 0))
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id IS NOT NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.payroll_generate(_year integer, _month integer, _employee_ids uuid[] DEFAULT NULL::uuid[], _include_inactive boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row record; v_generated int := 0; v_skipped int := 0; v_regenerated int := 0;
  v_exceptions jsonb := '[]'::jsonb; v_user uuid; v_period text; v_link text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _month < 1 OR _month > 12 OR _year < 2000 OR _year > 2100 THEN
    RAISE EXCEPTION 'INVALID_PERIOD';
  END IF;

  v_period := to_char(public.payroll_period_start(_year, _month), 'FMMonth YYYY');
  v_link := format('/employee/payroll?year=%s&month=%s', _year, _month);

  FOR v_row IN
    SELECT * FROM public.payroll_preview(_year, _month, _include_inactive) pv
    WHERE _employee_ids IS NULL OR pv.employee_id = ANY(_employee_ids)
  LOOP
    IF v_row.exception_reason IS NOT NULL THEN
      v_exceptions := v_exceptions || jsonb_build_object(
        'employee_id', v_row.employee_id, 'employee_name', v_row.employee_name,
        'login_id', v_row.login_id, 'reason', v_row.exception_reason);
      CONTINUE;
    END IF;

    IF v_row.existing_payroll_id IS NOT NULL THEN
      IF v_row.existing_status IN ('PROCESSED', 'PAID') THEN
        v_exceptions := v_exceptions || jsonb_build_object(
          'employee_id', v_row.employee_id, 'employee_name', v_row.employee_name,
          'login_id', v_row.login_id,
          'reason', 'Payroll already finalised for this period and cannot be changed');
        CONTINUE;
      END IF;

      UPDATE public.payroll_records SET
        basic_salary = v_row.basic_salary,
        gross_earnings = v_row.gross_earnings,
        total_deductions = v_row.total_deductions,
        net_salary = v_row.net_salary,
        earnings = v_row.earnings,
        deductions = v_row.deductions,
        attendance_summary = v_row.attendance_summary,
        leave_summary = v_row.leave_summary,
        status = 'GENERATED',
        generated_at = now(),
        generated_by = auth.uid()
      WHERE id = v_row.existing_payroll_id;

      v_regenerated := v_regenerated + 1;

      SELECT e.user_id INTO v_user FROM public.employees e WHERE e.id = v_row.employee_id;
      PERFORM public.notify_user(
        v_user, format('Payslip updated — %s', v_period),
        format('Your payslip for %s was regenerated and is ready to view. Net pay: %s.', v_period,
               trim(to_char(v_row.net_salary, 'FM999999990.00'))),
        'PAYROLL', v_link);
      CONTINUE;
    END IF;

    INSERT INTO public.payroll_records (
      employee_id, period_year, period_month, period_start, period_end,
      basic_salary, gross_earnings, total_deductions, net_salary,
      earnings, deductions, attendance_summary, leave_summary,
      status, generated_by)
    VALUES (
      v_row.employee_id, _year, _month,
      public.payroll_period_start(_year, _month), public.payroll_period_end(_year, _month),
      v_row.basic_salary, v_row.gross_earnings, v_row.total_deductions, v_row.net_salary,
      v_row.earnings, v_row.deductions, v_row.attendance_summary, v_row.leave_summary,
      'GENERATED', auth.uid())
    ON CONFLICT (employee_id, period_year, period_month) DO NOTHING;

    IF NOT FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_generated := v_generated + 1;

    SELECT e.user_id INTO v_user FROM public.employees e WHERE e.id = v_row.employee_id;
    PERFORM public.notify_user(
      v_user, format('Payslip available — %s', v_period),
      format('Your payslip for %s is ready. Net pay: %s.', v_period,
             trim(to_char(v_row.net_salary, 'FM999999990.00'))),
      'PAYROLL', v_link);
  END LOOP;

  RETURN jsonb_build_object(
    'period', v_period, 'year', _year, 'month', _month,
    'generated', v_generated, 'regenerated', v_regenerated, 'skipped', v_skipped,
    'exceptions', v_exceptions);
END; $function$;

CREATE OR REPLACE FUNCTION public.payroll_set_status(_id uuid, _status payroll_status)
 RETURNS payroll_records
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_row public.payroll_records; v_user uuid; v_period text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _status NOT IN ('PROCESSED', 'PAID') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;

  SELECT * INTO v_row FROM public.payroll_records WHERE id = _id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_row.status = 'PAID' THEN RAISE EXCEPTION 'ALREADY_FINALISED'; END IF;
  IF _status = 'PAID' AND v_row.status <> 'PROCESSED' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF _status = 'PROCESSED' AND v_row.status <> 'GENERATED' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;

  UPDATE public.payroll_records SET
    status = _status,
    processed_at = CASE WHEN _status = 'PROCESSED' THEN now() ELSE processed_at END,
    paid_at = CASE WHEN _status = 'PAID' THEN now() ELSE paid_at END
  WHERE id = _id RETURNING * INTO v_row;

  v_period := to_char(v_row.period_start, 'FMMonth YYYY');
  SELECT e.user_id INTO v_user FROM public.employees e WHERE e.id = v_row.employee_id;
  IF _status = 'PAID' THEN
    PERFORM public.notify_user(v_user, format('Salary paid — %s', v_period),
      format('Your net salary of %s for %s has been marked as paid.',
             trim(to_char(v_row.net_salary, 'FM999999990.00')), v_period),
      'PAYROLL',
      format('/employee/payroll?year=%s&month=%s', v_row.period_year, v_row.period_month));
  END IF;

  RETURN v_row;
END; $function$;