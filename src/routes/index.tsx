import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/pages/shared/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dayflow — HR management for modern teams" },
      {
        name: "description",
        content:
          "Dayflow unifies employee profiles, attendance, time-off and payroll for employees and HR teams. Every workday, perfectly aligned.",
      },
      { property: "og:title", content: "Dayflow — HR management for modern teams" },
      {
        property: "og:description",
        content: "Profiles, attendance, leave and payroll in one calm HR workspace.",
      },
    ],
  }),
  component: LandingPage,
});
