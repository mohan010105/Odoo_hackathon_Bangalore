REVOKE ALL ON FUNCTION public.export_job_claim(text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.export_job_claim(text, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.export_job_claim(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_job_claim(text, text, text, integer) TO service_role;