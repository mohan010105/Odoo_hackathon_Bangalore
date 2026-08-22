import { createFileRoute } from "@tanstack/react-router";

import { EmployeeLayout } from "@/layouts/EmployeeLayout";

export const Route = createFileRoute("/employee")({
  ssr: false,
  component: EmployeeLayout,
});
