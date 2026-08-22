import { createFileRoute, redirect } from "@tanstack/react-router";

/** Alias for the synchronisation section of the Odoo integration workspace. */
export const Route = createFileRoute("/settings/odoo/sync")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/integrations", replace: true });
  },
});
