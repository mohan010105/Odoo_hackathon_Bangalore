/**
 * Payroll business rules — the single client-side source of truth.
 *
 * Every monetary formula in the UI comes from here so no component invents its
 * own salary maths. The identical rules are implemented in SQL
 * (`payroll_component_amount`, `payroll_calculate`) and the database remains
 * authoritative: previews and finalised payroll records are always calculated
 * server-side. This module exists for display, form previews and validation.
 *
 * Rules:
 * - Percentage components are always calculated against BASIC SALARY.
 * - Gross earnings = basic salary + all active EARNING components.
 * - Total deductions = all active DEDUCTION components.
 * - Net salary = gross earnings − total deductions, never below zero.
 * - Money is rounded to 2 decimal places at every step.
 */

export const PAYROLL_STATUSES = ["DRAFT", "GENERATED", "PROCESSED", "PAID"] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

export const COMPONENT_TYPES = ["EARNING", "DEDUCTION"] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const CALCULATION_METHODS = ["FIXED", "PERCENTAGE"] as const;
export type CalculationMethod = (typeof CALCULATION_METHODS)[number];

/** Statuses that are finalised: they must never be silently rewritten. */
export const FINALISED_STATUSES: readonly PayrollStatus[] = ["PROCESSED", "PAID"];

export function isFinalised(status: string): boolean {
  return FINALISED_STATUSES.includes(status as PayrollStatus);
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Rounds to 2 decimals the same way the database does. */
export function money(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/** Formats an amount for display. Payroll runs in a single currency (INR). */
export function formatMoney(value: number | null | undefined, currency = "INR"): string {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatHours(value: number | null | undefined): string {
  const hours = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${hours.toFixed(2)} h`;
}

/* ------------------------------------------------------------------ periods */

export type PayrollPeriod = { year: number; month: number };

/** Payroll always runs on whole calendar months, in the business timezone. */
export function currentPeriod(): PayrollPeriod {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function periodStart({ year, month }: PayrollPeriod): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function periodEnd({ year, month }: PayrollPeriod): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}

/** e.g. "August 2026" */
export function periodLabel({ year, month }: PayrollPeriod): string {
  return `${monthName(month)} ${year}`;
}

/** e.g. "August 1, 2026 — August 31, 2026" */
export function periodRangeLabel(period: PayrollPeriod): string {
  const last = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  const name = monthName(period.month);
  return `${name} 1, ${period.year} — ${name} ${last}, ${period.year}`;
}

/** Monday–Friday days in the period; used as the working-day baseline. */
export function workingDaysInPeriod({ year, month }: PayrollPeriod): number {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= last; day += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

/** Selectable years: current year and the four before it. */
export function selectableYears(): number[] {
  const { year } = currentPeriod();
  return [year + 1, year, year - 1, year - 2, year - 3];
}

/* -------------------------------------------------------------- calculation */

export type ComponentLine = {
  code: string;
  name: string;
  component_type?: ComponentType;
  method: CalculationMethod;
  /** Configured value: an amount for FIXED, a percentage for PERCENTAGE. */
  value: number;
  amount: number;
  basis?: string;
};

export type SalaryBreakdown = {
  basic_salary: number;
  earnings: ComponentLine[];
  deductions: ComponentLine[];
  gross_earnings: number;
  total_deductions: number;
  net_salary: number;
  /** True when configured deductions exceed gross earnings. */
  invalid: boolean;
};

/** Amount contributed by a single component. Mirrors `payroll_component_amount`. */
export function componentAmount(
  method: CalculationMethod,
  value: number,
  basicSalary: number,
): number {
  const safeValue = Math.max(value || 0, 0);
  const safeBasic = Math.max(basicSalary || 0, 0);
  return method === "PERCENTAGE" ? money((safeBasic * safeValue) / 100) : money(safeValue);
}

export type ComponentConfig = {
  code: string;
  name: string;
  component_type: ComponentType;
  calculation_method: CalculationMethod;
  value: number;
  is_active?: boolean;
};

/** The one calculation routine used across the payroll UI. */
export function computeSalary(basicSalary: number, components: ComponentConfig[]): SalaryBreakdown {
  const basic = money(Math.max(basicSalary || 0, 0));
  const earnings: ComponentLine[] = [];
  const deductions: ComponentLine[] = [];

  for (const component of components) {
    if (component.is_active === false) continue;
    const line: ComponentLine = {
      code: component.code,
      name: component.name,
      component_type: component.component_type,
      method: component.calculation_method,
      value: component.value,
      amount: componentAmount(component.calculation_method, component.value, basic),
      basis: component.calculation_method === "PERCENTAGE" ? "BASIC" : "FIXED",
    };
    if (component.component_type === "EARNING") earnings.push(line);
    else deductions.push(line);
  }

  const gross = money(basic + earnings.reduce((sum, line) => sum + line.amount, 0));
  const rawDeductions = money(deductions.reduce((sum, line) => sum + line.amount, 0));

  return {
    basic_salary: basic,
    earnings,
    deductions,
    gross_earnings: gross,
    total_deductions: Math.min(rawDeductions, gross),
    net_salary: Math.max(money(gross - rawDeductions), 0),
    invalid: rawDeductions > gross,
  };
}

/** Human label for how a component is calculated, shown to admins. */
export function calculationBasisLabel(method: CalculationMethod, value: number): string {
  return method === "PERCENTAGE" ? `${value}% of basic salary` : "Fixed amount";
}

export type AttendanceContext = {
  working_days?: number;
  present_days?: number;
  half_days?: number;
  leave_days?: number;
  absent_days?: number;
  work_hours?: number;
  extra_hours?: number;
};

export type LeaveContext = {
  paid_days?: number;
  unpaid_days?: number;
  requests?: number;
};

export function attendanceContext(value: unknown): AttendanceContext {
  return (value ?? {}) as AttendanceContext;
}

export function leaveContext(value: unknown): LeaveContext {
  return (value ?? {}) as LeaveContext;
}

export function componentLines(value: unknown): ComponentLine[] {
  return Array.isArray(value) ? (value as ComponentLine[]) : [];
}
