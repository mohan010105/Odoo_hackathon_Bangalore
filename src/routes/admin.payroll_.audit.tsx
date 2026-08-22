import { createFileRoute } from "@tanstack/react-router";

import { PayrollAuditPage } from "@/pages/admin/PayrollAuditPage";

export const Route = createFileRoute("/admin/payroll_/audit")({
  head: () => ({
    meta: [
      { title: "Payroll activity log — Dayflow" },
      {
        name: "description",
        content:
          "Review who previewed, generated, exported and finalised each Dayflow payroll period.",
      },
      { property: "og:title", content: "Payroll activity log — Dayflow" },
      {
        property: "og:description",
        content: "Administrator audit trail for payroll previews, runs, exports and payments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayrollAuditPage,
});
