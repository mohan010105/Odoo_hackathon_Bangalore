-- 1. Employment status enum additions
ALTER TYPE public.employee_status ADD VALUE IF NOT EXISTS 'PROBATION';
ALTER TYPE public.employee_status ADD VALUE IF NOT EXISTS 'RESIGNED';
ALTER TYPE public.employee_status ADD VALUE IF NOT EXISTS 'TERMINATED';

-- 2. Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS departments_name_key ON public.departments (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY departments_select_authenticated ON public.departments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY departments_insert_admin ON public.departments
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY departments_update_admin ON public.departments
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY departments_delete_admin ON public.departments
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER departments_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Job positions
CREATE TABLE IF NOT EXISTS public.job_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS job_positions_title_dept_key
  ON public.job_positions (lower(title), COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_positions TO authenticated;
GRANT ALL ON public.job_positions TO service_role;
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_positions_select_authenticated ON public.job_positions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY job_positions_insert_admin ON public.job_positions
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY job_positions_update_admin ON public.job_positions
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY job_positions_delete_admin ON public.job_positions
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER job_positions_updated_at BEFORE UPDATE ON public.job_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Optional structured links on employees (free-text columns preserved)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL;

-- 5. Confidential employee information
CREATE TABLE IF NOT EXISTS public.employee_private_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  date_of_birth date,
  gender text,
  marital_status text,
  personal_email text,
  personal_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  tax_id text,
  national_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_private_info TO authenticated;
GRANT ALL ON public.employee_private_info TO service_role;
ALTER TABLE public.employee_private_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_private_info_select_own_or_admin ON public.employee_private_info
  FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY employee_private_info_insert_admin ON public.employee_private_info
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY employee_private_info_update_admin ON public.employee_private_info
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY employee_private_info_delete_admin ON public.employee_private_info
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER employee_private_info_updated_at BEFORE UPDATE ON public.employee_private_info
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS employees_department_id_idx ON public.employees (department_id);
CREATE INDEX IF NOT EXISTS employees_position_id_idx ON public.employees (position_id);