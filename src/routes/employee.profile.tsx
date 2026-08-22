import { createFileRoute } from "@tanstack/react-router";

import { EmployeeProfilePage } from "@/pages/employee/EmployeeProfilePage";

export const Route = createFileRoute("/employee/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Dayflow" },
      {
        name: "description",
        content: "Personal, job and contact details for your Dayflow profile.",
      },
      { property: "og:title", content: "My profile — Dayflow" },
      {
        property: "og:description",
        content: "Personal, job and contact details for your Dayflow profile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeeProfilePage,
});
