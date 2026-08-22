-- Entitlement change history (leave allocations + salary structures) with
-- effective dates and previous values, plus employee notifications.

CREATE TABLE IF NOT EXISTS public.entitlement_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  change_type text NOT NULL CHECK (change_type IN ('LEAVE_ALLOCATION', 'SALARY_STRUCTURE')),
  label text NOT NULL,
  effective_from date,
  effective_to date,
  previous_value jsonb,
  new_value jsonb,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entitlement_changes_employee_idx
  ON public.entitlement_changes (employee_id, created_at DESC);

GRANT SELECT ON public.entitlement_changes TO authenticated;
GRANT ALL ON public.entitlement_changes TO service_role;

ALTER TABLE public.entitlement_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees read own entitlement history" ON public.entitlement_changes;
CREATE POLICY "Employees read own entitlement history"
ON public.entitlement_changes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = entitlement_changes.employee_id AND e.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins read all entitlement history" ON public.entitlement_changes;
CREATE POLICY "Admins read all entitlement history"
ON public.entitlement_changes FOR SELECT TO authenticated
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.record_entitlement_change(
  _employee_id uuid,
  _change_type text,
  _label text,
  _effective_from date,
  _effective_to date,
  _previous jsonb,
  _new jsonb,
  _title text,
  _body text,
  _category text,
  _link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  INSERT INTO public.entitlement_changes
    (employee_id, change_type, label, effective_from, effective_to,
     previous_value, new_value, changed_by)
  VALUES (_employee_id, _change_type, _label, _effective_from, _effective_to,
          _previous, _new, auth.uid());

  SELECT user_id INTO v_user FROM public.employees WHERE id = _employee_id;
  IF v_user IS NOT NULL THEN
    PERFORM public.notify_user(v_user, _title, _body, _category, _link);
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.record_entitlement_change(uuid, text, text, date, date, jsonb, jsonb, text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.leave_allocation_upsert(
  _employee_id uuid,
  _leave_type_id uuid,
  _allocated_days numeric,
  _valid_from date,
  _valid_to date,
  _allocation_id uuid DEFAULT NULL
)
RETURNS public.leave_allocations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.leave_allocations;
  v_before public.leave_allocations;
  v_type text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _allocated_days IS NULL OR _allocated_days < 0 THEN RAISE EXCEPTION 'INVALID_DAYS'; END IF;
  IF _valid_from IS NULL OR _valid_to IS NULL OR _valid_to < _valid_from THEN
    RAISE EXCEPTION 'INVALID_PERIOD';
  END IF;

  IF _allocation_id IS NOT NULL THEN
    SELECT * INTO v_before FROM public.leave_allocations WHERE id = _allocation_id FOR UPDATE;
    IF v_before.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF _allocated_days < v_before.used_days THEN RAISE EXCEPTION 'BELOW_USED'; END IF;

    UPDATE public.leave_allocations
       SET allocated_days = _allocated_days, valid_from = _valid_from, valid_to = _valid_to
     WHERE id = v_before.id
     RETURNING * INTO v_row;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.leave_allocations a
      WHERE a.employee_id = _employee_id AND a.leave_type_id = _leave_type_id
        AND a.valid_from <= _valid_to AND a.valid_to >= _valid_from
    ) THEN RAISE EXCEPTION 'DUPLICATE_ALLOCATION'; END IF;

    INSERT INTO public.leave_allocations
      (employee_id, leave_type_id, allocated_days, valid_from, valid_to)
    VALUES (_employee_id, _leave_type_id, _allocated_days, _valid_from, _valid_to)
    RETURNING * INTO v_row;
  END IF;

  SELECT name INTO v_type FROM public.leave_types WHERE id = v_row.leave_type_id;

  PERFORM public.record_entitlement_change(
    v_row.employee_id,
    'LEAVE_ALLOCATION',
    coalesce(v_type, 'Leave') || ' allocation',
    v_row.valid_from,
    v_row.valid_to,
    CASE WHEN v_before.id IS NULL THEN NULL ELSE jsonb_build_object(
      'allocated_days', v_before.allocated_days,
      'valid_from', v_before.valid_from,
      'valid_to', v_before.valid_to) END,
    jsonb_build_object(
      'allocated_days', v_row.allocated_days,
      'valid_from', v_row.valid_from,
      'valid_to', v_row.valid_to),
    CASE WHEN v_before.id IS NULL THEN 'Leave allocated' ELSE 'Leave balance updated' END,
    format('%s: %s days for %s to %s.',
           coalesce(v_type, 'Leave'), v_row.allocated_days, v_row.valid_from, v_row.valid_to),
    'LEAVE',
    '/employee/leave'
  );

  RETURN v_row;
END; $$;

REVOKE EXECUTE ON FUNCTION public.leave_allocation_upsert(uuid, uuid, numeric, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_allocation_upsert(uuid, uuid, numeric, date, date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.salary_structure_save(
  _employee_id uuid, _basic_salary numeric, _effective_from date,
  _components jsonb, _notes text DEFAULT NULL)
RETURNS public.salary_structures LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.salary_structures;
  v_before public.salary_structures;
  v_item jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _basic_salary IS NULL OR _basic_salary <= 0 THEN RAISE EXCEPTION 'INVALID_BASIC'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = _employee_id) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT * INTO v_before FROM public.salary_structures
  WHERE employee_id = _employee_id AND is_active;

  IF v_before.id IS NULL THEN
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
    WHERE id = v_before.id RETURNING * INTO v_row;
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

  PERFORM public.record_entitlement_change(
    v_row.employee_id,
    'SALARY_STRUCTURE',
    'Salary structure',
    v_row.effective_from,
    NULL,
    CASE WHEN v_before.id IS NULL THEN NULL ELSE jsonb_build_object(
      'basic_salary', v_before.basic_salary,
      'effective_from', v_before.effective_from) END,
    jsonb_build_object(
      'basic_salary', v_row.basic_salary,
      'effective_from', v_row.effective_from),
    CASE WHEN v_before.id IS NULL THEN 'Salary structure assigned' ELSE 'Salary structure updated' END,
    format('Effective %s. Your salary and payslip section is now up to date.', v_row.effective_from),
    'PAYROLL',
    '/employee/payroll'
  );

  RETURN v_row;
END; $$;

REVOKE EXECUTE ON FUNCTION public.salary_structure_save(uuid, numeric, date, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salary_structure_save(uuid, numeric, date, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_entitlement_history()
RETURNS SETOF public.entitlement_changes
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c.* FROM public.entitlement_changes c
  JOIN public.employees e ON e.id = c.employee_id
  WHERE e.user_id = auth.uid()
  ORDER BY c.created_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.my_entitlement_history() TO authenticated;