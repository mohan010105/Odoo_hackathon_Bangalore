REVOKE ALL ON FUNCTION public.attendance_check_in() FROM anon, public;
REVOKE ALL ON FUNCTION public.attendance_check_out() FROM anon, public;
REVOKE ALL ON FUNCTION public.attendance_admin_update(uuid, timestamptz, timestamptz, public.attendance_status, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.current_employee_id() FROM anon, public;
REVOKE ALL ON FUNCTION public.business_today() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.attendance_check_in() TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_check_out() TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_admin_update(uuid, timestamptz, timestamptz, public.attendance_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_today() TO authenticated;