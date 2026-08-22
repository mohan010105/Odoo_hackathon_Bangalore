import { createFileRoute } from "@tanstack/react-router";

import { AdminLeaveBalancesPage } from "@/pages/admin/AdminLeaveBalancesPage";

export const Route = createFileRoute("/admin/leave_/balances")({
  head: () => ({
    meta: [
      { title: "Leave allocations — Dayflow" },
      {
        name: "description",
        content: "Allocate leave per employee and manage Dayflow leave policies.",
      },
      { property: "og:title", content: "Leave allocations — Dayflow" },
      {
        property: "og:description",
        content: "Manage employee leave allocations, balances and leave types.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLeaveBalancesPage,
});
