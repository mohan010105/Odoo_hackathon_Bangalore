import {
  attendanceContext,
  componentLines,
  formatMoney,
  leaveContext,
  periodLabel,
  periodRangeLabel,
  type PayrollPeriod,
} from "@/lib/payroll/rules";
import type { PayrollRecordRow, PayrollSummary } from "@/services/payroll/payrollService";

/** Escapes a single CSV cell so commas, quotes and newlines survive Excel. */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: string[], rows: Array<Array<string | number | null>>): string {
  return [header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join(
    "\n",
  );
}

/** Triggers a browser download for a generated file. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function periodSlug({ year, month }: PayrollPeriod): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function employeeName(record: PayrollRecordRow): string {
  return record.employees
    ? `${record.employees.first_name} ${record.employees.last_name}`.trim()
    : "Employee";
}

const REGISTER_HEADER = [
  "Login ID",
  "Employee",
  "Department",
  "Designation",
  "Period",
  "Period start",
  "Period end",
  "Currency",
  "Basic salary",
  "Gross earnings",
  "Total deductions",
  "Net salary",
  "Earnings breakdown",
  "Deductions breakdown",
  "Working days",
  "Present days",
  "Leave days",
  "Paid leave days",
  "Unpaid leave days",
  "Extra hours",
  "Status",
  "Generated at",
  "Processed at",
  "Paid at",
];

/** Payroll register CSV: one row per payslip in the selected period. */
export function registerCsv(records: PayrollRecordRow[], period: PayrollPeriod): string {
  const rows = records.map((record) => {
    const attendance = attendanceContext(record.attendance_summary);
    const leave = leaveContext(record.leave_summary);
    const breakdown = (lines: ReturnType<typeof componentLines>) =>
      lines.map((line) => `${line.name}: ${line.amount}`).join(" | ");

    return [
      record.employees?.login_id ?? "",
      employeeName(record),
      record.employees?.department ?? "",
      record.employees?.job_position ?? "",
      periodLabel(period),
      record.period_start,
      record.period_end,
      record.currency,
      Number(record.basic_salary),
      Number(record.gross_earnings),
      Number(record.total_deductions),
      Number(record.net_salary),
      breakdown(componentLines(record.earnings)),
      breakdown(componentLines(record.deductions)),
      attendance.working_days ?? 0,
      attendance.present_days ?? 0,
      attendance.leave_days ?? 0,
      leave.paid_days ?? 0,
      leave.unpaid_days ?? 0,
      attendance.extra_hours ?? 0,
      record.status,
      record.generated_at ? new Date(record.generated_at).toLocaleString() : "",
      record.processed_at ? new Date(record.processed_at).toLocaleString() : "",
      record.paid_at ? new Date(record.paid_at).toLocaleString() : "",
    ];
  });

  return toCsv(REGISTER_HEADER, rows);
}

/** Dashboard summary CSV for the selected period: real totals, no estimates. */
export function summaryCsv(summary: PayrollSummary, period: PayrollPeriod): string {
  return toCsv(
    ["Metric", "Value"],
    [
      ["Period", periodLabel(period)],
      ["Period range", periodRangeLabel(period)],
      ["Active employees", summary.totalEmployees],
      ["Employees in payroll", summary.eligibleEmployees],
      ["Exceptions", summary.exceptions],
      ["Payslips generated", summary.generated],
      ["Pending", summary.pending],
      ["Processed", summary.processed],
      ["Paid", summary.paid],
      ["Total gross", summary.totalGross],
      ["Total deductions", summary.totalDeductions],
      ["Total net pay", summary.totalNet],
    ],
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Self-contained, printable payslip document for the ZIP archive. Values come
 * straight from the stored payroll record — nothing is recalculated here.
 */
export function payslipHtml(
  record: PayrollRecordRow,
  period: PayrollPeriod,
  companyName?: string,
): string {
  const attendance = attendanceContext(record.attendance_summary);
  const leave = leaveContext(record.leave_summary);
  const earnings = componentLines(record.earnings);
  const deductions = componentLines(record.deductions);
  const money = (value: number) => formatMoney(value, record.currency);

  const lines = (items: typeof earnings) =>
    items
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.name)}</td><td class="num">${escapeHtml(money(Number(item.amount)))}</td></tr>`,
      )
      .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Payslip ${escapeHtml(periodLabel(period))} — ${escapeHtml(employeeName(record))}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, Arial, sans-serif; color: #16223a; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.meta { color: #5a6784; margin: 0 0 24px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
  th, td { border-bottom: 1px solid #dfe4ec; padding: 8px 6px; text-align: left; }
  td.num, th.num { text-align: right; }
  tfoot td { font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; font-size: 13px; }
  .grid span { display: block; color: #5a6784; font-size: 11px; text-transform: uppercase; }
  .net { font-size: 16px; font-weight: 700; }
</style></head>
<body>
  <h1>Payslip — ${escapeHtml(periodLabel(period))}</h1>
  <p class="meta">${companyName ? `${escapeHtml(companyName)} · ` : ""}${escapeHtml(periodRangeLabel(period))} · status ${escapeHtml(record.status)}</p>

  <div class="grid">
    <div><span>Employee</span>${escapeHtml(employeeName(record))}</div>
    <div><span>Login ID</span>${escapeHtml(record.employees?.login_id ?? "—")}</div>
    <div><span>Department</span>${escapeHtml(record.employees?.department ?? "—")}</div>
    <div><span>Designation</span>${escapeHtml(record.employees?.job_position ?? "—")}</div>
    <div><span>Working days</span>${attendance.working_days ?? 0}</div>
    <div><span>Present days</span>${attendance.present_days ?? 0}</div>
    <div><span>Paid leave</span>${leave.paid_days ?? 0}</div>
    <div><span>Extra hours</span>${attendance.extra_hours ?? 0}</div>
  </div>

  <table>
    <thead><tr><th>Earnings</th><th class="num">Amount</th></tr></thead>
    <tbody>
      <tr><td>Basic salary</td><td class="num">${escapeHtml(money(Number(record.basic_salary)))}</td></tr>
      ${lines(earnings)}
    </tbody>
    <tfoot><tr><td>Gross earnings</td><td class="num">${escapeHtml(money(Number(record.gross_earnings)))}</td></tr></tfoot>
  </table>

  <table>
    <thead><tr><th>Deductions</th><th class="num">Amount</th></tr></thead>
    <tbody>${lines(deductions) || '<tr><td colspan="2">No deductions</td></tr>'}</tbody>
    <tfoot><tr><td>Total deductions</td><td class="num">${escapeHtml(money(Number(record.total_deductions)))}</td></tr></tfoot>
  </table>

  <p class="net">Net salary: ${escapeHtml(money(Number(record.net_salary)))}</p>
  <p class="meta">Generated ${record.generated_at ? escapeHtml(new Date(record.generated_at).toLocaleString()) : "—"}. This document is system generated.</p>
</body></html>`;
}

/** Safe, collision-resistant file name for a payslip inside the archive. */
export function payslipFileName(record: PayrollRecordRow, period: PayrollPeriod): string {
  const base = `${record.employees?.login_id ?? record.employee_id}-${employeeName(record)}`
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replaceAll(" ", "-");
  return `${periodSlug(period)}-${base || "payslip"}.html`;
}
