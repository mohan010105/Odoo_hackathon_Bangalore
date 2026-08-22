import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { OdooIntegrationPage } from "@/pages/admin/OdooIntegrationPage";
import { ODOO_ENTITIES } from "@/lib/odoo/models";

/** Sync activity filters live in the URL so a filtered view is shareable. */
const searchSchema = z.object({
  entity: z.enum(ODOO_ENTITIES).optional(),
  status: z.enum(["SUCCESS", "FAILED", "SKIPPED", "NOT_AVAILABLE"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const Route = createFileRoute("/admin/integrations")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Odoo integration — Dayflow" },
      {
        name: "description",
        content:
          "Test the Dayflow to Odoo connection, monitor sync health, run bulk employee syncs and retry failed records.",
      },
      { property: "og:title", content: "Odoo integration — Dayflow" },
      {
        property: "og:description",
        content: "Administrator dashboard for Odoo connection testing and data synchronisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OdooIntegrationPage,
});
