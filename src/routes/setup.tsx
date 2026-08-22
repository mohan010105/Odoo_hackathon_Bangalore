import { createFileRoute } from "@tanstack/react-router";

import { BootstrapAdminPage } from "@/pages/auth/BootstrapAdminPage";

export const Route = createFileRoute("/setup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Workspace setup — Dayflow HRMS" },
      {
        name: "description",
        content: "One-time setup of the HR administrator account for your Dayflow workspace.",
      },
      { property: "og:title", content: "Workspace setup — Dayflow HRMS" },
      {
        property: "og:description",
        content: "Create the first HR administrator for your Dayflow workspace.",
      },
    ],
  }),
  component: BootstrapAdminPage,
});
