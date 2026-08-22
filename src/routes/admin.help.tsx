import { createFileRoute } from "@tanstack/react-router";

import { HelpPage } from "@/pages/shared/HelpPage";

export const Route = createFileRoute("/admin/help")({
  head: () => ({
    meta: [
      { title: "Help — Dayflow admin" },
      {
        name: "description",
        content: "Guidance for administering employees, attendance, leave and payroll in Dayflow.",
      },
      { property: "og:title", content: "Help — Dayflow admin" },
      {
        property: "og:description",
        content: "Guidance for administering employees, attendance, leave and payroll in Dayflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});
