import { createFileRoute } from "@tanstack/react-router";

import { CreateEmployeePage } from "@/pages/admin/CreateEmployeePage";

export const Route = createFileRoute("/admin/employees/new")({
  head: () => ({
    meta: [
      { title: "Add employee — Dayflow" },
      {
        name: "description",
        content: "Provision an employee account with a generated Login ID and temporary password.",
      },
    ],
  }),
  component: CreateEmployeePage,
});
