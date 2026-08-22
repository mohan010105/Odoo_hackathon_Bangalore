import { createFileRoute } from "@tanstack/react-router";

import { AdminAttendancePage } from "@/pages/admin/AdminAttendancePage";

export const Route = createFileRoute("/admin/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance monitoring — Dayflow" },
      {
        name: "description",
        content: "Monitor daily attendance, work hours and overtime across your organisation.",
      },
      { property: "og:title", content: "Attendance monitoring — Dayflow" },
      {
        property: "og:description",
        content: "Organisation-wide attendance, work hours and corrections in Dayflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAttendancePage,
});
