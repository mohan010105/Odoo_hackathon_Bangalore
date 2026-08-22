import { createFileRoute } from "@tanstack/react-router";

import { EmployeePayrollPage } from "@/pages/employee/EmployeePayrollPage";

type PayrollSearch = { year?: number; month?: number };

export const Route = createFileRoute("/employee/payroll")({
  validateSearch: (search: Record<string, unknown>): PayrollSearch => {
    const year = Number(search['year']);
    const month = Number(search['month']);
    return {
      ...(Number.isInteger(year) && year >= 2000 && year <= 2100 ? { year } : {}),
      ...(Number.isInteger(month) && month >= 1 && month <= 12 ? { month } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "My payroll — Dayflow" },
      {
        name: "description",
        content: "View your Dayflow salary structure, monthly payslips and net pay.",
      },
      { property: "og:title", content: "My payroll — Dayflow" },
      {
        property: "og:description",
        content: "Your salary breakdown and downloadable payslip history in Dayflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeePayrollPage,
});
