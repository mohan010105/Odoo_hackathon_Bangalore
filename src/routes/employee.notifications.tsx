import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage } from "@/pages/NotificationsPage";

export const Route = createFileRoute("/employee/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Dayflow" },
      {
        name: "description",
        content: "Attendance corrections, leave decisions and HR updates for your Dayflow account.",
      },
      { property: "og:title", content: "Notifications — Dayflow" },
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
