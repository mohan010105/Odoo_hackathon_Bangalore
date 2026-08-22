import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Stable alias for the Odoo integration workspace. The destination lives under
 * the admin layout, so its role guard — and the admin checks inside every Odoo
 * server function — remain the real authorization boundary.
 */
export const Route = createFileRoute("/settings/odoo/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/integrations", replace: true });
  },
});
