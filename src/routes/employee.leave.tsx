import { createFileRoute } from "@tanstack/react-router";

import { EmployeeLeavePage } from "@/pages/employee/EmployeeLeavePage";

export const Route = createFileRoute("/employee/leave")({
  head: () => ({
    meta: [
      { title: "My leave — Dayflow" },
      { name: "description", content: "Request time off and track approval status in Dayflow." },
      { property: "og:title", content: "My leave — Dayflow" },
      {
        property: "og:description",
        content: "Request time off, see your balance and follow approvals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeeLeavePage,
});
