import { createFileRoute } from "@tanstack/react-router";

import { AdminPayrollPage } from "@/pages/admin/AdminPayrollPage";

export const Route = createFileRoute("/admin/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll processing — Dayflow" },
      {
        name: "description",
        content:
          "Generate payroll, review payslips and track net pay for every Dayflow employee.",
      },
      { property: "og:title", content: "Payroll processing — Dayflow" },
      {
        property: "og:description",
        content: "Run monthly payroll, review payslips and mark salaries as processed or paid.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPayrollPage,
});
