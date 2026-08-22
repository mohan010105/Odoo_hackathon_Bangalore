-- Roles
CREATE TYPE public.app_role AS ENUM ('ADMIN', 'EMPLOYEE');
CREATE TYPE public.employee_status AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'ADMIN'::public.app_role);
$$;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "companies_select_authenticated" ON public.companies
FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_insert_admin" ON public.companies
FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "companies_update_admin" ON public.companies
FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- employees
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  login_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  joining_date DATE NOT NULL,
  department TEXT,
  job_position TEXT,
  manager TEXT,
  location TEXT,
  profile_picture TEXT,
  status public.employee_status NOT NULL DEFAULT 'INACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "employees_select_own_or_admin" ON public.employees
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "employees_insert_admin" ON public.employees
FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "employees_update_admin" ON public.employees
FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "employees_delete_admin" ON public.employees
FOR DELETE TO authenticated USING (public.is_admin());

-- login id sequence per joining year (never decremented; deletions cannot cause reuse)
CREATE TABLE public.employee_login_sequences (
  joining_year INT PRIMARY KEY,
  last_serial INT NOT NULL DEFAULT 0
);
GRANT ALL ON public.employee_login_sequences TO service_role;
ALTER TABLE public.employee_login_sequences ENABLE ROW LEVEL SECURITY;

-- Atomic, collision-proof login id generation (database side only)
CREATE OR REPLACE FUNCTION public.generate_employee_login_id(
  _first_name TEXT, _last_name TEXT, _joining_date DATE
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_first TEXT; v_last TEXT; v_prefix TEXT; v_year INT; v_serial INT; v_candidate TEXT;
BEGIN
  v_first := upper(regexp_replace(coalesce(_first_name, ''), '[^A-Za-z]', '', 'g'));
  v_last  := upper(regexp_replace(coalesce(_last_name, ''), '[^A-Za-z]', '', 'g'));
  v_first := rpad(left(v_first, 2), 2, 'X');
  v_last  := rpad(left(v_last, 2), 2, 'X');
  v_prefix := v_first || v_last;
  v_year := EXTRACT(YEAR FROM _joining_date)::INT;

  LOOP
    INSERT INTO public.employee_login_sequences (joining_year, last_serial)
    VALUES (v_year, 1)
    ON CONFLICT (joining_year) DO UPDATE
      SET last_serial = public.employee_login_sequences.last_serial + 1
    RETURNING last_serial INTO v_serial;

    v_candidate := v_prefix || v_year::TEXT || lpad(v_serial::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.employees WHERE login_id = v_candidate);
  END LOOP;

  RETURN v_candidate;
END; $$;
REVOKE ALL ON FUNCTION public.generate_employee_login_id(TEXT, TEXT, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_employee_login_id(TEXT, TEXT, DATE) FROM anon;
REVOKE ALL ON FUNCTION public.generate_employee_login_id(TEXT, TEXT, DATE) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.generate_employee_login_id(TEXT, TEXT, DATE) TO service_role;

-- Resolve a login id to its sign-in email (exact match only; used by the sign-in service)
CREATE OR REPLACE FUNCTION public.email_for_login_id(_login_id TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.employees WHERE upper(login_id) = upper(trim(_login_id)) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.email_for_login_id(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_for_login_id(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.email_for_login_id(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.email_for_login_id(TEXT) TO service_role;

-- Storage policies (buckets are private; reads happen through signed URLs)
CREATE POLICY "logos_authenticated_read" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'company-logos');
CREATE POLICY "logos_admin_write" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-logos' AND public.is_admin());
CREATE POLICY "logos_admin_update" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'company-logos' AND public.is_admin());
CREATE POLICY "logos_admin_delete" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'company-logos' AND public.is_admin());

CREATE POLICY "avatars_authenticated_read" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'profile-pictures');
CREATE POLICY "avatars_admin_write" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-pictures' AND public.is_admin());
CREATE POLICY "avatars_admin_update" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'profile-pictures' AND public.is_admin());
CREATE POLICY "avatars_admin_delete" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'profile-pictures' AND public.is_admin());