-- Internal-only helpers: not part of the app-facing API surface.
REVOKE ALL ON FUNCTION public.payroll_calculate(uuid) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_attendance_summary(uuid, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_leave_summary(uuid, integer, integer) FROM anon, authenticated, PUBLIC;

-- Admin-guarded routines: signed-in callers only, never anonymous.
REVOKE ALL ON FUNCTION public.payroll_preview(integer, integer, boolean) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_generate(integer, integer, uuid[], boolean) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_set_status(uuid, public.payroll_status) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.salary_structure_save(uuid, numeric, date, jsonb, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.salary_component_save(uuid, text, text, public.salary_component_type, public.salary_calculation_method, numeric, boolean, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.salary_structure_detail(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.my_salary_structure() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.payroll_preview(integer, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_generate(integer, integer, uuid[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_set_status(uuid, public.payroll_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salary_structure_save(uuid, numeric, date, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salary_component_save(uuid, text, text, public.salary_component_type, public.salary_calculation_method, numeric, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salary_structure_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_salary_structure() TO authenticated;

-- Public/period helpers are pure math and stay callable, but not by anonymous users.
REVOKE ALL ON FUNCTION public.payroll_period_start(integer, integer) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_period_end(integer, integer) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_working_days(integer, integer) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_component_amount(public.salary_calculation_method, numeric, numeric) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.payroll_period_start(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_period_end(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_working_days(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_component_amount(public.salary_calculation_method, numeric, numeric) TO authenticated;