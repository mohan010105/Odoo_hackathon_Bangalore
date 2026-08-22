CREATE POLICY "employee_documents_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'employee-documents' AND public.is_admin())
  WITH CHECK (bucket_id = 'employee-documents' AND public.is_admin());

CREATE POLICY "employee_documents_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[1] = public.current_employee_id()::text
  );