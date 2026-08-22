REVOKE EXECUTE ON FUNCTION public.leave_submit(uuid, date, date, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_balance(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_allocation_upsert(uuid, uuid, numeric, date, date, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_type_upsert(text, text, text, boolean, boolean, boolean, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM anon, authenticated;
