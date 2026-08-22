import { createFileRoute } from "@tanstack/react-router";

import { DepartmentsPage } from "@/pages/admin/DepartmentsPage";

export const Route = createFileRoute("/admin/departments")({
  head: () => ({
    meta: [
      { title: "Departments — Dayflow" },
      {
        name: "description",
        content: "Organise Dayflow employees into departments and reporting lines.",
      },
      { property: "og:title", content: "Departments — Dayflow" },
      {
        property: "og:description",
        content: "Organise Dayflow employees into departments and reporting lines.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DepartmentsPage,
});
