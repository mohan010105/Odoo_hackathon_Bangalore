import { createFileRoute } from "@tanstack/react-router";

import { AuditLogsPage } from "@/pages/admin/AuditLogsPage";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Activity log — Dayflow" },
      {
        name: "description",
        content: "Admin-only record of employee provisioning, sign-ins and password changes.",
      },
      { property: "og:title", content: "Activity log — Dayflow" },
      {
        property: "og:description",
        content: "Admin-only record of employee provisioning, sign-ins and password changes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditLogsPage,
});
