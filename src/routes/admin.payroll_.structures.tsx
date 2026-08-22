import { createFileRoute } from "@tanstack/react-router";

import { AdminSalaryStructuresPage } from "@/pages/admin/AdminSalaryStructuresPage";

export const Route = createFileRoute("/admin/payroll_/structures")({
  head: () => ({
    meta: [
      { title: "Salary structures — Dayflow" },
      {
        name: "description",
        content: "Configure basic salary, earnings and deductions for each Dayflow employee.",
      },
      { property: "og:title", content: "Salary structures — Dayflow" },
      {
        property: "og:description",
        content: "Assign salary structures and manage the payroll component catalogue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSalaryStructuresPage,
});
