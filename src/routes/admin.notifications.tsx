import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage } from "@/pages/NotificationsPage";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [
      { title: "HR notifications — Dayflow" },
      {
        name: "description",
        content: "Leave, attendance and HR updates sent to your Dayflow admin account.",
      },
      { property: "og:title", content: "HR notifications — Dayflow" },
      {
        property: "og:description",
        content: "Every HR update sent to you, with read and unread state.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});
