import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Dayflow" },
      { name: "description", content: "HR reporting and analytics workspace in Dayflow." },
    ],
  }),
  component: () => (
    <ModulePlaceholder
      title="Reports"
      description="HR reporting across attendance, leave and payroll."
      emptyTitle="No reports available yet"
      emptyDescription="Reporting is built on top of connected HR data and arrives in a later phase."
    />
  ),
});
