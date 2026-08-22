import { createFileRoute } from "@tanstack/react-router";

import { CompanySettingsPage } from "@/pages/admin/CompanySettingsPage";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Company settings — Dayflow" },
      { name: "description", content: "Manage your company name and logo in Dayflow." },
    ],
  }),
  component: CompanySettingsPage,
});
