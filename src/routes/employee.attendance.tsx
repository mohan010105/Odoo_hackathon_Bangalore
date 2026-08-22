import { createFileRoute } from "@tanstack/react-router";

import { EmployeeAttendancePage } from "@/pages/employee/EmployeeAttendancePage";

export const Route = createFileRoute("/employee/attendance")({
  head: () => ({
    meta: [
      { title: "My attendance — Dayflow" },
      {
        name: "description",
        content: "Check in, check out and review your Dayflow attendance and work hours.",
      },
      { property: "og:title", content: "My attendance — Dayflow" },
      {
        property: "og:description",
        content: "Daily check-in, check-out and hours worked in Dayflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeeAttendancePage,
});
