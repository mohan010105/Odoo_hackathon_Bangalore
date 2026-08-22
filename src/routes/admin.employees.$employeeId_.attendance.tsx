import { createFileRoute } from "@tanstack/react-router";

import { AdminEmployeeAttendancePage } from "@/pages/admin/EmployeeAttendancePage";

export const Route = createFileRoute("/admin/employees/$employeeId_/attendance")({
  head: () => ({
    meta: [
      { title: "Employee attendance — Dayflow" },
      {
        name: "description",
        content: "Monthly attendance history, work hours and overtime for one employee.",
      },
      { property: "og:title", content: "Employee attendance — Dayflow" },
      {
        property: "og:description",
        content: "Attendance history and totals for a Dayflow employee.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeeAttendanceRoute,
});

function EmployeeAttendanceRoute() {
  const { employeeId } = Route.useParams();
  return <AdminEmployeeAttendancePage employeeId={employeeId} />;
}
