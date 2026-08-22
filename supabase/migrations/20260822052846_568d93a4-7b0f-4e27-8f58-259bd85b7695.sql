CREATE OR REPLACE FUNCTION public.payroll_generate(
  _year integer, _month integer, _employee_ids uuid[] DEFAULT NULL,
  _include_inactive boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row record; v_generated int := 0; v_skipped int := 0; v_regenerated int := 0;
  v_exceptions jsonb := '[]'::jsonb; v_user uuid; v_period text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _month < 1 OR _month > 12 OR _year < 2000 OR _year > 2100 THEN
    RAISE EXCEPTION 'INVALID_PERIOD';
  END IF;

  v_period := to_char(public.payroll_period_start(_year, _month), 'FMMonth YYYY');

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
        'PAYROLL', '/employee/payroll');
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
      'PAYROLL', '/employee/payroll');
  END LOOP;

  RETURN jsonb_build_object(
    'period', v_period, 'year', _year, 'month', _month,
    'generated', v_generated, 'regenerated', v_regenerated, 'skipped', v_skipped,
    'exceptions', v_exceptions);
END; $$;

REVOKE ALL ON FUNCTION public.payroll_generate(integer, integer, uuid[], boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.payroll_generate(integer, integer, uuid[], boolean) TO authenticated;