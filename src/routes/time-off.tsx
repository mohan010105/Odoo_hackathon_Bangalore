import { createFileRoute } from "@tanstack/react-router";

import { PortalRedirect } from "@/pages/shared/PortalRedirect";

export const Route = createFileRoute("/time-off")({
  head: () => ({
    meta: [
      { title: "Time off — Dayflow" },
      {
        name: "description",
        content:
          "Open your Dayflow time-off workspace: leave balances, requests and HR approvals.",
      },
      { property: "og:title", content: "Time off — Dayflow" },
      {
        property: "og:description",
        content: "Request leave, track balances and review approvals in Dayflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PortalRedirect adminTo="/admin/leave" employeeTo="/employee/leave" />,
});
