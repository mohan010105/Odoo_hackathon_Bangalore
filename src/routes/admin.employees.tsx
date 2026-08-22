import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/employees")({
  head: () => ({
    meta: [
      { title: "Employees — Dayflow" },
      { name: "description", content: "Employee directory and record management in Dayflow." },
    ],
  }),
  component: () => <Outlet />,
});
