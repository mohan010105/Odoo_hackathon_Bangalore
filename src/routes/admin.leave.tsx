import { createFileRoute } from "@tanstack/react-router";

import { AdminLeavePage } from "@/pages/admin/AdminLeavePage";

export const Route = createFileRoute("/admin/leave")({
  head: () => ({
    meta: [
      { title: "Leave approvals — Dayflow" },
      {
        name: "description",
        content: "Review and decide on employee time-off requests in Dayflow.",
      },
      { property: "og:title", content: "Leave approvals — Dayflow" },
      {
        property: "og:description",
        content: "Approve or reject employee time-off requests with a comment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLeavePage,
});
