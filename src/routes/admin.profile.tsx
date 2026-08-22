import { createFileRoute } from "@tanstack/react-router";

import { AdminProfilePage } from "@/pages/admin/AdminProfilePage";

export const Route = createFileRoute("/admin/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Dayflow" },
      {
        name: "description",
        content: "Manage your Dayflow HR administrator picture and contact details.",
      },
      { property: "og:title", content: "My profile — Dayflow" },
      {
        property: "og:description",
        content: "Manage your Dayflow HR administrator picture and contact details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminProfilePage,
});
