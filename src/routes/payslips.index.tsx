import { createFileRoute } from "@tanstack/react-router";

import { PortalRedirect } from "@/pages/shared/PortalRedirect";

export const Route = createFileRoute("/payslips/")({
  head: () => ({
    meta: [
      { title: "Payslips — Dayflow" },
      {
        name: "description",
        content: "Open your Dayflow payslip workspace and review monthly net pay.",
      },
      { property: "og:title", content: "Payslips — Dayflow" },
      {
        property: "og:description",
        content: "Monthly payslips, salary breakdown and net pay in Dayflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PortalRedirect adminTo="/admin/payroll" employeeTo="/employee/payroll" />,
});
