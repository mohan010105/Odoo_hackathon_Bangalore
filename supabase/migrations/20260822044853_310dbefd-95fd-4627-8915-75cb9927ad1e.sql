REVOKE EXECUTE ON FUNCTION public.leave_submit(uuid, date, date, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.leave_balance(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.leave_allocation_upsert(uuid, uuid, numeric, date, date, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.leave_type_upsert(text, text, text, boolean, boolean, boolean, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.leave_submit(uuid, date, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_balance(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_allocation_upsert(uuid, uuid, numeric, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_type_upsert(text, text, text, boolean, boolean, boolean, uuid) TO authenticated;
