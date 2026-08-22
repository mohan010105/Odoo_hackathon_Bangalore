import { createFileRoute } from "@tanstack/react-router";

import { PayslipDetailPage } from "@/pages/shared/PayslipDetailPage";

export const Route = createFileRoute("/payslips/$payslipId")({
  head: () => ({
    meta: [
      { title: "Payslip detail — Dayflow" },
      {
        name: "description",
        content: "A printable Dayflow payslip with earnings, deductions and net pay.",
      },
      { property: "og:title", content: "Payslip detail — Dayflow" },
      {
        property: "og:description",
        content: "Printable payslip with salary breakdown, attendance and leave context.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayslipRoute,
});

function PayslipRoute() {
  const { payslipId } = Route.useParams();
  return <PayslipDetailPage payslipId={payslipId} />;
}
