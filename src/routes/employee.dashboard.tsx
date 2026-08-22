import { createFileRoute } from "@tanstack/react-router";

import { EmployeeDashboardPage } from "@/pages/employee/EmployeeDashboardPage";

export const Route = createFileRoute("/employee/dashboard")({
  head: () => ({
    meta: [
      { title: "My workspace — Dayflow" },
      { name: "description", content: "Your Dayflow dashboard for attendance, leave and payroll." },
    ],
  }),
  component: EmployeeDashboardPage,
});
