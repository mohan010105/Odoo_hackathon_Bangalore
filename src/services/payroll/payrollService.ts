import {
  generatePayroll,
  getMySalaryStructure,
  getPayrollRecord,
  getPayrollSummary,
  getSalaryStructure,
  listMyPayrollRecords,
  listPayrollRecords,
  listSalaryComponents,
  listSalaryStructures,
  listPayrollRecordsForExport,
  previewPayroll,
  recordPayrollExport,
  saveSalaryComponent,
  saveSalaryStructure,
  setPayrollStatus,
} from "@/lib/payroll.functions";
import type { AttendanceContext, ComponentLine, LeaveContext } from "@/lib/payroll/rules";
import type {
  PayrollGenerateInput,
  SalaryComponentInput,
  SalaryStructureInput,
} from "@/lib/validation/payroll";

export type SalaryComponentRow = {
  id: string;
  code: string;
  name: string;
  component_type: "EARNING" | "DEDUCTION";
  calculation_method: "FIXED" | "PERCENTAGE";
  default_value: number;
  description: string | null;
  is_active: boolean;
};

export type StructureComponentRow = {
  component_id: string;
  code: string;
  name: string;
  component_type: "EARNING" | "DEDUCTION";
  calculation_method: "FIXED" | "PERCENTAGE";
  value: number;
  is_active: boolean;
};

export type SalaryStructureRow = {
  employee_id: string;
  login_id: string;
  employee_name: string;
  email: string;
  department: string | null;
  job_position: string | null;
  employee_status: string;
  structure_id: string | null;
  basic_salary: number;
  effective_from: string | null;
  currency: string;
  components: StructureComponentRow[];
};

export type SalaryStructureDetail = {
  employee: {
    id: string;
    login_id: string;
    name: string;
    email: string;
    department: string | null;
    job_position: string | null;
  } | null;
  structure: {
    id: string;
    basic_salary: number;
    effective_from: string;
    currency: string;
    notes: string | null;
  } | null;
  components: StructureComponentRow[];
  breakdown: {
    basic_salary: number;
    earnings: ComponentLine[];
    deductions: ComponentLine[];
    gross_earnings: number;
    total_deductions: number;
    net_salary: number;
  } | null;
};

export type PayrollPreviewRow = {
  employee_id: string;
  login_id: string;
  employee_name: string;
  department: string | null;
  job_position: string | null;
  employee_status: string;
  structure_id: string | null;
  basic_salary: number;
  gross_earnings: number;
  total_deductions: number;
  net_salary: number;
  attendance_summary: AttendanceContext;
  leave_summary: LeaveContext;
  exception_reason: string | null;
  existing_payroll_id: string | null;
  existing_status: string | null;
};

export type PayrollEmployee = {
  id: string;
  login_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
  job_position: string | null;
  location: string | null;
  joining_date: string;
};

export type PayrollRecordRow = {
  id: string;
  employee_id: string;
  period_year: number;
  period_month: number;
  period_start: string;
  period_end: string;
  basic_salary: number;
  gross_earnings: number;
  total_deductions: number;
  net_salary: number;
  earnings: ComponentLine[];
  deductions: ComponentLine[];
  attendance_summary: AttendanceContext;
  leave_summary: LeaveContext;
  currency: string;
  status: "DRAFT" | "GENERATED" | "PROCESSED" | "PAID";
  generated_at: string;
  processed_at: string | null;
  paid_at: string | null;
  notes: string | null;
  employees?: PayrollEmployee | null;
};

export type PayrollSummary = {
  totalEmployees: number;
  eligibleEmployees: number;
  exceptions: number;
  generated: number;
  pending: number;
  processed: number;
  paid: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
};

export type PayrollRegisterFilters = {
  year?: number;
  month?: number;
  status?: "DRAFT" | "GENERATED" | "PROCESSED" | "PAID";
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Payroll boundary. Every call runs through an authenticated server function:
 * amounts are always calculated in the database, employees only ever read
 * their own records, and salary configuration is admin-gated on the server.
 */
export const payrollService = {
  /* ------------------------------------------------------------ components */
  async listComponents(includeInactive = true): Promise<SalaryComponentRow[]> {
    return (await listSalaryComponents({ data: { includeInactive } })) as SalaryComponentRow[];
  },

  async saveComponent(input: SalaryComponentInput) {
    return saveSalaryComponent({ data: input });
  },

  /* ------------------------------------------------------------ structures */
  async listStructures(filters: {
    search?: string;
    department?: string;
    onlyMissing?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: SalaryStructureRow[]; total: number }> {
    return (await listSalaryStructures({ data: filters })) as {
      rows: SalaryStructureRow[];
      total: number;
    };
  },

  async structureFor(employeeId: string): Promise<SalaryStructureDetail> {
    return (await getSalaryStructure({ data: { employeeId } })) as unknown as SalaryStructureDetail;
  },

  async saveStructure(input: SalaryStructureInput) {
    return saveSalaryStructure({ data: input });
  },

  async mySalaryStructure(): Promise<SalaryStructureDetail> {
    return (await getMySalaryStructure({})) as unknown as SalaryStructureDetail;
  },

  /* --------------------------------------------------------------- payroll */
  async preview(input: {
    year: number;
    month: number;
    includeInactive?: boolean;
  }): Promise<PayrollPreviewRow[]> {
    return (await previewPayroll({ data: input })) as unknown as PayrollPreviewRow[];
  },

  async generate(input: PayrollGenerateInput) {
    return generatePayroll({ data: input }) as Promise<{
      period?: string;
      generated?: number;
      regenerated?: number;
      skipped?: number;
      exceptions?: { employee_name?: string; reason?: string }[];
    }>;
  },

  async summary(period: { year: number; month: number }): Promise<PayrollSummary> {
    return (await getPayrollSummary({ data: period })) as PayrollSummary;
  },

  async listRecords(
    filters: PayrollRegisterFilters,
  ): Promise<{ rows: PayrollRecordRow[]; total: number }> {
    return (await listPayrollRecords({ data: filters })) as unknown as {
      rows: PayrollRecordRow[];
      total: number;
    };
  },

  /** Every record for one period, used by the CSV and payslip exports. */
  async recordsForExport(period: {
    year: number;
    month: number;
    status?: "DRAFT" | "GENERATED" | "PROCESSED" | "PAID";
  }): Promise<PayrollRecordRow[]> {
    return (await listPayrollRecordsForExport({ data: period })) as unknown as PayrollRecordRow[];
  },

  /** Writes the export to the admin activity log after the file is built. */
  async logExport(input: {
    year: number;
    month: number;
    kind: "SUMMARY" | "REGISTER" | "PAYSLIPS";
    recordCount: number;
    idempotencyKey: string;
  }): Promise<{ duplicate: boolean }> {
    const result = await recordPayrollExport({ data: input });
    return { duplicate: Boolean((result as { duplicate?: boolean }).duplicate) };
  },

  async record(id: string): Promise<PayrollRecordRow> {
    return (await getPayrollRecord({ data: { id } })) as unknown as PayrollRecordRow;
  },

  async listMine(): Promise<PayrollRecordRow[]> {
    return (await listMyPayrollRecords({})) as unknown as PayrollRecordRow[];
  },

  async setStatus(id: string, status: "PROCESSED" | "PAID") {
    return setPayrollStatus({ data: { id, status } });
  },
};
