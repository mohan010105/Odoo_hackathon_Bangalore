import { createFileRoute } from "@tanstack/react-router";

import { AdminEmployeeLeavePage } from "@/pages/admin/AdminEmployeeLeavePage";

export const Route = createFileRoute("/admin/employees/$employeeId_/leave")({
  head: () => ({
    meta: [
      { title: "Employee leave history — Dayflow" },
      {
        name: "description",
        content: "Review one employee's leave balances and complete request history in Dayflow.",
      },
      { property: "og:title", content: "Employee leave history — Dayflow" },
      {
        property: "og:description",
        content: "Balances, allocations and every leave request for a single employee.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminEmployeeLeavePage,
});
