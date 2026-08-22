import { createFileRoute } from "@tanstack/react-router";

import { JobPositionsPage } from "@/pages/admin/JobPositionsPage";

export const Route = createFileRoute("/admin/positions")({
  head: () => ({
    meta: [
      { title: "Job positions — Dayflow" },
      {
        name: "description",
        content: "Define job positions and openings across your Dayflow organisation.",
      },
      { property: "og:title", content: "Job positions — Dayflow" },
      {
        property: "og:description",
        content: "Define job positions and openings across your Dayflow organisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JobPositionsPage,
});
