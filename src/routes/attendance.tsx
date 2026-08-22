import { createFileRoute } from "@tanstack/react-router";

import { PortalRedirect } from "@/pages/shared/PortalRedirect";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Dayflow" },
      {
        name: "description",
        content:
          "Open your Dayflow attendance workspace: check in, check out and review work hours.",
      },
      { property: "og:title", content: "Attendance — Dayflow" },
      {
        property: "og:description",
        content: "Daily check-in, check-out and organisation attendance in Dayflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PortalRedirect adminTo="/admin/attendance" employeeTo="/employee/attendance" />
  ),
});
