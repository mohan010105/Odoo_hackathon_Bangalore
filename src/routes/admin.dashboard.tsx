import { createFileRoute } from "@tanstack/react-router";

import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "HR operations — Dayflow" },
      {
        name: "description",
        content: "HR dashboard for people, attendance, approvals and payroll.",
      },
    ],
  }),
  component: AdminDashboardPage,
});
