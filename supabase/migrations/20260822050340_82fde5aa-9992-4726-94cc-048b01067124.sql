-- ============ ENUMS ============
CREATE TYPE public.salary_component_type AS ENUM ('EARNING', 'DEDUCTION');
CREATE TYPE public.salary_calculation_method AS ENUM ('FIXED', 'PERCENTAGE');
CREATE TYPE public.payroll_status AS ENUM ('DRAFT', 'GENERATED', 'PROCESSED', 'PAID');

-- ============ SALARY COMPONENTS ============
CREATE TABLE public.salary_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  component_type public.salary_component_type NOT NULL,
  calculation_method public.salary_calculation_method NOT NULL DEFAULT 'FIXED',
  default_value numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salary_components_value_nonneg CHECK (default_value >= 0)
);
GRANT SELECT ON public.salary_components TO authenticated;
GRANT ALL ON public.salary_components TO service_role;
ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY salary_components_select_admin ON public.salary_components
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE TRIGGER salary_components_updated_at BEFORE UPDATE ON public.salary_components
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SALARY STRUCTURES ============
CREATE TABLE public.salary_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT public.business_today(),
  currency text NOT NULL DEFAULT 'INR',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salary_structures_basic_nonneg CHECK (basic_salary >= 0)
);
CREATE UNIQUE INDEX salary_structures_one_active_per_employee
  ON public.salary_structures (employee_id) WHERE is_active;
GRANT SELECT ON public.salary_structures TO authenticated;
GRANT ALL ON public.salary_structures TO service_role;
ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY salary_structures_select_own_or_admin ON public.salary_structures
  FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());

CREATE TRIGGER salary_structures_updated_at BEFORE UPDATE ON public.salary_structures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STRUCTURE COMPONENT VALUES ============
CREATE TABLE public.salary_structure_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES public.salary_structures(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.salary_components(id) ON DELETE RESTRICT,
  value numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (structure_id, component_id),
  CONSTRAINT salary_structure_components_value_nonneg CHECK (value >= 0)
);
GRANT SELECT ON public.salary_structure_components TO authenticated;
GRANT ALL ON public.salary_structure_components TO service_role;
ALTER TABLE public.salary_structure_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY salary_structure_components_select_own_or_admin ON public.salary_structure_components
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.salary_structures s
      WHERE s.id = structure_id AND s.employee_id = public.current_employee_id()
    )
  );
CREATE TRIGGER salary_structure_components_updated_at BEFORE UPDATE ON public.salary_structure_components
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PAYROLL RECORDS ============
CREATE TABLE public.payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  gross_earnings numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  earnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  deductions jsonb NOT NULL DEFAULT '[]'::jsonb,
  attendance_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  leave_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  currency text NOT NULL DEFAULT 'INR',
  status public.payroll_status NOT NULL DEFAULT 'GENERATED',
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid,
  processed_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_year, period_month),
  CONSTRAINT payroll_records_month_range CHECK (period_month BETWEEN 1 AND 12),
  CONSTRAINT payroll_records_year_range CHECK (period_year BETWEEN 2000 AND 2100),
  CONSTRAINT payroll_records_amounts_nonneg CHECK (
    basic_salary >= 0 AND gross_earnings >= 0 AND total_deductions >= 0 AND net_salary >= 0
  )
);
CREATE INDEX payroll_records_period_idx ON public.payroll_records (period_year, period_month);
CREATE INDEX payroll_records_employee_idx ON public.payroll_records (employee_id);
GRANT SELECT ON public.payroll_records TO authenticated;
GRANT ALL ON public.payroll_records TO service_role;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_records_select_own_or_admin ON public.payroll_records
  FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE TRIGGER payroll_records_updated_at BEFORE UPDATE ON public.payroll_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PERIOD HELPERS ============
CREATE OR REPLACE FUNCTION public.payroll_period_start(_year integer, _month integer)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT make_date(_year, _month, 1);
$$;

CREATE OR REPLACE FUNCTION public.payroll_period_end(_year integer, _month integer)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (make_date(_year, _month, 1) + interval '1 month - 1 day')::date;
$$;

CREATE OR REPLACE FUNCTION public.payroll_working_days(_year integer, _month integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT count(*)::int
  FROM generate_series(
    public.payroll_period_start(_year, _month),
    public.payroll_period_end(_year, _month),
    interval '1 day') d
  WHERE EXTRACT(ISODOW FROM d) < 6;
$$;

-- ============ COMPONENT AMOUNT ============
CREATE OR REPLACE FUNCTION public.payroll_component_amount(
  _method public.salary_calculation_method, _value numeric, _basic numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _method = 'PERCENTAGE' THEN round(GREATEST(coalesce(_basic,0),0) * GREATEST(coalesce(_value,0),0) / 100.0, 2)
    ELSE round(GREATEST(coalesce(_value,0),0), 2)
  END;
$$;

-- ============ SINGLE SOURCE OF TRUTH CALCULATION ============
CREATE OR REPLACE FUNCTION public.payroll_calculate(_structure_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_basic numeric; v_earnings jsonb; v_deductions jsonb;
  v_gross numeric; v_ded numeric;
BEGIN
  SELECT basic_salary INTO v_basic FROM public.salary_structures WHERE id = _structure_id;
  IF v_basic IS NULL THEN RAISE EXCEPTION 'NO_STRUCTURE'; END IF;

  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'code', c.code, 'name', c.name, 'method', c.calculation_method,
      'value', sc.value, 'basis', CASE WHEN c.calculation_method = 'PERCENTAGE' THEN 'BASIC' ELSE 'FIXED' END,
      'amount', public.payroll_component_amount(c.calculation_method, sc.value, v_basic)
    ) ORDER BY c.name) FILTER (WHERE c.component_type = 'EARNING'), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object(
      'code', c.code, 'name', c.name, 'method', c.calculation_method,
      'value', sc.value, 'basis', CASE WHEN c.calculation_method = 'PERCENTAGE' THEN 'BASIC' ELSE 'FIXED' END,
      'amount', public.payroll_component_amount(c.calculation_method, sc.value, v_basic)
    ) ORDER BY c.name) FILTER (WHERE c.component_type = 'DEDUCTION'), '[]'::jsonb),
    coalesce(sum(public.payroll_component_amount(c.calculation_method, sc.value, v_basic))
      FILTER (WHERE c.component_type = 'EARNING'), 0),
    coalesce(sum(public.payroll_component_amount(c.calculation_method, sc.value, v_basic))
      FILTER (WHERE c.component_type = 'DEDUCTION'), 0)
  INTO v_earnings, v_deductions, v_gross, v_ded
  FROM public.salary_structure_components sc
  JOIN public.salary_components c ON c.id = sc.component_id
  WHERE sc.structure_id = _structure_id AND sc.is_active AND c.is_active;

  v_basic := round(v_basic, 2);
  v_gross := round(v_basic + coalesce(v_gross, 0), 2);
  v_ded := round(coalesce(v_ded, 0), 2);

  RETURN jsonb_build_object(
    'basic_salary', v_basic,
    'earnings', v_earnings,
    'deductions', v_deductions,
    'gross_earnings', v_gross,
    'total_deductions', LEAST(v_ded, v_gross),
    'raw_total_deductions', v_ded,
    'net_salary', GREATEST(round(v_gross - v_ded, 2), 0)
  );
END; $$;

-- ============ CONTEXT SUMMARIES ============
CREATE OR REPLACE FUNCTION public.payroll_attendance_summary(_employee_id uuid, _year integer, _month integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'working_days', public.payroll_working_days(_year, _month),
    'present_days', coalesce(count(*) FILTER (WHERE a.status = 'PRESENT'), 0),
    'half_days', coalesce(count(*) FILTER (WHERE a.status = 'HALF_DAY'), 0),
    'leave_days', coalesce(count(*) FILTER (WHERE a.status = 'LEAVE'), 0),
    'absent_days', coalesce(count(*) FILTER (WHERE a.status = 'ABSENT'), 0),
    'work_hours', coalesce(round(sum(a.work_hours), 2), 0),
    'extra_hours', coalesce(round(sum(a.extra_hours), 2), 0)
  )
  FROM public.attendance a
  WHERE a.employee_id = _employee_id
    AND a.attendance_date BETWEEN public.payroll_period_start(_year, _month)
                              AND public.payroll_period_end(_year, _month);
$$;

CREATE OR REPLACE FUNCTION public.payroll_leave_summary(_employee_id uuid, _year integer, _month integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'paid_days', coalesce(round(sum(overlap_days) FILTER (WHERE is_paid), 2), 0),
    'unpaid_days', coalesce(round(sum(overlap_days) FILTER (WHERE NOT is_paid), 2), 0),
    'requests', coalesce(count(*), 0)
  )
  FROM (
    SELECT t.is_paid,
      (SELECT count(*) FROM generate_series(
          GREATEST(r.start_date, public.payroll_period_start(_year, _month)),
          LEAST(r.end_date, public.payroll_period_end(_year, _month)),
          interval '1 day') g)::numeric AS overlap_days
    FROM public.leave_requests r
    JOIN public.leave_types t ON t.id = r.leave_type_id
    WHERE r.employee_id = _employee_id
      AND r.status = 'APPROVED'
      AND r.start_date <= public.payroll_period_end(_year, _month)
      AND r.end_date >= public.payroll_period_start(_year, _month)
  ) s;
$$;

-- ============ PREVIEW ============
CREATE OR REPLACE FUNCTION public.payroll_preview(
  _year integer, _month integer, _include_inactive boolean DEFAULT false)
RETURNS TABLE(
  employee_id uuid, login_id text, employee_name text, department text, job_position text,
  employee_status public.employee_status, structure_id uuid, basic_salary numeric,
  gross_earnings numeric, total_deductions numeric, net_salary numeric,
  earnings jsonb, deductions jsonb, attendance_summary jsonb, leave_summary jsonb,
  exception_reason text, existing_payroll_id uuid, existing_status public.payroll_status)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _month < 1 OR _month > 12 OR _year < 2000 OR _year > 2100 THEN
    RAISE EXCEPTION 'INVALID_PERIOD';
  END IF;

  RETURN QUERY
  SELECT e.id,
    e.login_id,
    (e.first_name || ' ' || e.last_name),
    e.department,
    e.job_position,
    e.status,
    s.id,
    coalesce((calc.result->>'basic_salary')::numeric, 0),
    coalesce((calc.result->>'gross_earnings')::numeric, 0),
    coalesce((calc.result->>'total_deductions')::numeric, 0),
    coalesce((calc.result->>'net_salary')::numeric, 0),
    coalesce(calc.result->'earnings', '[]'::jsonb),
    coalesce(calc.result->'deductions', '[]'::jsonb),
    public.payroll_attendance_summary(e.id, _year, _month),
    public.payroll_leave_summary(e.id, _year, _month),
    CASE
      WHEN s.id IS NULL THEN 'Salary structure missing'
      WHEN coalesce(s.basic_salary, 0) <= 0 THEN 'Invalid salary configuration: basic salary is zero'
      WHEN coalesce((calc.result->>'raw_total_deductions')::numeric, 0)
           > coalesce((calc.result->>'gross_earnings')::numeric, 0)
        THEN 'Invalid salary configuration: deductions exceed gross earnings'
      ELSE NULL
    END,
    p.id,
    p.status
  FROM public.employees e
  LEFT JOIN public.salary_structures s ON s.employee_id = e.id AND s.is_active
  LEFT JOIN LATERAL (SELECT public.payroll_calculate(s.id) AS result WHERE s.id IS NOT NULL) calc ON true
  LEFT JOIN public.payroll_records p
    ON p.employee_id = e.id AND p.period_year = _year AND p.period_month = _month
  WHERE (_include_inactive OR e.status IN ('ACTIVE', 'ON_LEAVE'))
  ORDER BY e.first_name, e.last_name;
END; $$;

-- ============ GENERATE ============
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

-- ============ STATUS TRANSITIONS ============
CREATE OR REPLACE FUNCTION public.payroll_set_status(_id uuid, _status public.payroll_status)
RETURNS public.payroll_records LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      'PAYROLL', '/employee/payroll');
  END IF;

  RETURN v_row;
END; $$;

-- ============ SALARY STRUCTURE MANAGEMENT ============
CREATE OR REPLACE FUNCTION public.salary_structure_save(
  _employee_id uuid, _basic_salary numeric, _effective_from date,
  _components jsonb, _notes text DEFAULT NULL)
RETURNS public.salary_structures LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.salary_structures; v_item jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _basic_salary IS NULL OR _basic_salary <= 0 THEN RAISE EXCEPTION 'INVALID_BASIC'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = _employee_id) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT * INTO v_row FROM public.salary_structures
  WHERE employee_id = _employee_id AND is_active;

  IF v_row.id IS NULL THEN
    INSERT INTO public.salary_structures (employee_id, basic_salary, effective_from, notes)
    VALUES (_employee_id, round(_basic_salary, 2),
            coalesce(_effective_from, public.business_today()),
            NULLIF(btrim(coalesce(_notes, '')), ''))
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.salary_structures SET
      basic_salary = round(_basic_salary, 2),
      effective_from = coalesce(_effective_from, effective_from),
      notes = NULLIF(btrim(coalesce(_notes, '')), '')
    WHERE id = v_row.id RETURNING * INTO v_row;
  END IF;

  DELETE FROM public.salary_structure_components WHERE structure_id = v_row.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(_components, '[]'::jsonb))
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.salary_components
                   WHERE id = (v_item->>'component_id')::uuid) THEN
      RAISE EXCEPTION 'UNKNOWN_COMPONENT';
    END IF;
    IF coalesce((v_item->>'value')::numeric, 0) < 0 THEN RAISE EXCEPTION 'INVALID_VALUE'; END IF;

    INSERT INTO public.salary_structure_components (structure_id, component_id, value, is_active)
    VALUES (v_row.id, (v_item->>'component_id')::uuid,
            round(coalesce((v_item->>'value')::numeric, 0), 2),
            coalesce((v_item->>'is_active')::boolean, true));
  END LOOP;

  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.salary_component_save(
  _id uuid, _code text, _name text,
  _component_type public.salary_component_type,
  _calculation_method public.salary_calculation_method,
  _default_value numeric, _is_active boolean, _description text DEFAULT NULL)
RETURNS public.salary_components LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.salary_components; v_code text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  v_code := upper(regexp_replace(btrim(coalesce(_code, '')), '[^A-Za-z0-9_]', '_', 'g'));
  IF v_code = '' THEN RAISE EXCEPTION 'INVALID_CODE'; END IF;
  IF btrim(coalesce(_name, '')) = '' THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  IF coalesce(_default_value, 0) < 0 THEN RAISE EXCEPTION 'INVALID_VALUE'; END IF;
  IF _calculation_method = 'PERCENTAGE' AND coalesce(_default_value, 0) > 100 THEN
    RAISE EXCEPTION 'INVALID_PERCENTAGE';
  END IF;

  IF _id IS NULL THEN
    BEGIN
      INSERT INTO public.salary_components
        (code, name, component_type, calculation_method, default_value, is_active, description)
      VALUES (v_code, btrim(_name), _component_type, _calculation_method,
              round(coalesce(_default_value, 0), 2), coalesce(_is_active, true),
              NULLIF(btrim(coalesce(_description, '')), ''))
      RETURNING * INTO v_row;
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'DUPLICATE_CODE';
    END;
  ELSE
    BEGIN
      UPDATE public.salary_components SET
        code = v_code, name = btrim(_name), component_type = _component_type,
        calculation_method = _calculation_method,
        default_value = round(coalesce(_default_value, 0), 2),
        is_active = coalesce(_is_active, true),
        description = NULLIF(btrim(coalesce(_description, '')), '')
      WHERE id = _id RETURNING * INTO v_row;
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'DUPLICATE_CODE';
    END;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  END IF;

  RETURN v_row;
END; $$;

-- ============ EMPLOYEE SELF-SERVICE SALARY VIEW ============
CREATE OR REPLACE FUNCTION public.my_salary_structure()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_employee uuid; v_structure public.salary_structures;
BEGIN
  v_employee := public.current_employee_id();
  IF v_employee IS NULL THEN RAISE EXCEPTION 'NO_EMPLOYEE_RECORD'; END IF;

  SELECT * INTO v_structure FROM public.salary_structures
  WHERE employee_id = v_employee AND is_active;

  IF v_structure.id IS NULL THEN RETURN NULL; END IF;

  RETURN public.payroll_calculate(v_structure.id)
    || jsonb_build_object('effective_from', v_structure.effective_from,
                          'currency', v_structure.currency);
END; $$;

CREATE OR REPLACE FUNCTION public.salary_structure_detail(_employee_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_structure public.salary_structures;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO v_structure FROM public.salary_structures
  WHERE employee_id = _employee_id AND is_active;
  IF v_structure.id IS NULL THEN RETURN NULL; END IF;

  RETURN public.payroll_calculate(v_structure.id)
    || jsonb_build_object(
      'structure_id', v_structure.id,
      'effective_from', v_structure.effective_from,
      'notes', v_structure.notes,
      'currency', v_structure.currency,
      'components', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'component_id', c.id, 'code', c.code, 'name', c.name,
          'component_type', c.component_type, 'calculation_method', c.calculation_method,
          'value', sc.value, 'is_active', sc.is_active) ORDER BY c.name)
        FROM public.salary_structure_components sc
        JOIN public.salary_components c ON c.id = sc.component_id
        WHERE sc.structure_id = v_structure.id), '[]'::jsonb));
END; $$;

-- ============ SEED DEFAULT COMPONENTS ============
INSERT INTO public.salary_components (code, name, component_type, calculation_method, default_value, description)
VALUES
  ('HRA', 'House Rent Allowance', 'EARNING', 'PERCENTAGE', 20, 'Percentage of basic salary'),
  ('TRANSPORT', 'Transport Allowance', 'EARNING', 'FIXED', 2000, 'Fixed monthly travel allowance'),
  ('OTHER_ALLOWANCE', 'Other Allowance', 'EARNING', 'FIXED', 0, 'Discretionary allowance'),
  ('PF', 'Provident Fund', 'DEDUCTION', 'PERCENTAGE', 12, 'Percentage of basic salary'),
  ('PROFESSIONAL_TAX', 'Professional Tax', 'DEDUCTION', 'FIXED', 200, 'Fixed monthly professional tax'),
  ('OTHER_DEDUCTION', 'Other Deduction', 'DEDUCTION', 'FIXED', 0, 'Adjustments and recoveries');