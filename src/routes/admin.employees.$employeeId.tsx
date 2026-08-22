import { createFileRoute } from "@tanstack/react-router";

import { EmployeeDetailPage } from "@/pages/admin/EmployeeDetailPage";

export const Route = createFileRoute("/admin/employees/$employeeId")({
  head: () => ({
    meta: [
      { title: "Employee record — Dayflow" },
      { name: "description", content: "Employee record details in the Dayflow HR workspace." },
    ],
  }),
  component: EmployeeRoute,
});

function EmployeeRoute() {
  const { employeeId } = Route.useParams();
  return <EmployeeDetailPage employeeId={employeeId} />;
}
