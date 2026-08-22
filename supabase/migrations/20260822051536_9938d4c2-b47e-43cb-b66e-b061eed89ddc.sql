CREATE TYPE public.integration_sync_status AS ENUM ('PENDING', 'SYNCED', 'FAILED');
CREATE TYPE public.integration_entity AS ENUM ('EMPLOYEE', 'ATTENDANCE', 'LEAVE', 'PAYROLL');

CREATE TABLE public.odoo_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type public.integration_entity NOT NULL,
  local_id uuid NOT NULL,
  odoo_id bigint,
  sync_status public.integration_sync_status NOT NULL DEFAULT 'PENDING',
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, local_id)
);

CREATE INDEX odoo_mappings_status_idx ON public.odoo_mappings (entity_type, sync_status);

GRANT SELECT ON public.odoo_mappings TO authenticated;
GRANT ALL ON public.odoo_mappings TO service_role;

ALTER TABLE public.odoo_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "odoo_mappings_select_admin" ON public.odoo_mappings
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE TRIGGER odoo_mappings_updated_at
  BEFORE UPDATE ON public.odoo_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.odoo_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type public.integration_entity NOT NULL,
  direction text NOT NULL DEFAULT 'DAYFLOW_TO_ODOO',
  local_id uuid,
  odoo_id bigint,
  record_label text,
  status text NOT NULL,
  error_code text,
  error_message text,
  duration_ms integer,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX odoo_sync_logs_created_idx ON public.odoo_sync_logs (created_at DESC);

GRANT SELECT ON public.odoo_sync_logs TO authenticated;
GRANT ALL ON public.odoo_sync_logs TO service_role;

ALTER TABLE public.odoo_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "odoo_sync_logs_select_admin" ON public.odoo_sync_logs
  FOR SELECT TO authenticated USING (public.is_admin());