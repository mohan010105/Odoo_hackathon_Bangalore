import { createFileRoute } from "@tanstack/react-router";

import { HelpPage } from "@/pages/shared/HelpPage";

export const Route = createFileRoute("/employee/help")({
  head: () => ({
    meta: [
      { title: "Help — Dayflow" },
      {
        name: "description",
        content: "Find your way around attendance, time off and payslips in Dayflow.",
      },
      { property: "og:title", content: "Help — Dayflow" },
      {
        property: "og:description",
        content: "Find your way around attendance, time off and payslips in Dayflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});
