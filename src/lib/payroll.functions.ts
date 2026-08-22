import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/rbac";
import {
  payrollGenerateSchema,
  payrollPeriodSchema,
  payrollStatusSchema,
  salaryComponentSchema,
  salaryStructureSchema,
} from "@/lib/validation/payroll";

const PAYROLL_COLUMNS =
  "id, employee_id, period_year, period_month, period_start, period_end, basic_salary, gross_earnings, total_deductions, net_salary, earnings, deductions, attendance_summary, leave_summary, currency, status, generated_at, processed_at, paid_at, notes";

const EMPLOYEE_JOIN =
  "employees!inner(id, login_id, first_name, last_name, email, department, job_position, location, joining_date)";

/** Turns database exceptions into messages HR and employees can act on. */
function friendlyError(message: string): Error {
  if (message.includes("FORBIDDEN"))
    return new Error("You are not authorised to perform this payroll operation.");
  if (message.includes("INVALID_PERIOD"))
    return new Error("That payroll period is not valid. Choose a month and year.");
  if (message.includes("NO_STRUCTURE") || message.includes("Salary structure missing"))
    return new Error("Salary structure is missing for this employee.");
  if (message.includes("INVALID_BASIC"))
    return new Error("Basic salary must be greater than zero.");
  if (message.includes("INVALID_PERCENTAGE"))
    return new Error("A percentage component cannot exceed 100%.");
  if (message.includes("INVALID_VALUE")) return new Error("Component values cannot be negative.");
  if (message.includes("UNKNOWN_COMPONENT"))
    return new Error("One of the selected salary components no longer exists.");
  if (message.includes("DUPLICATE_CODE"))
    return new Error("That salary component code is already used.");
  if (message.includes("ALREADY_FINALISED"))
    return new Error("This payroll is already paid and cannot be changed.");
  if (message.includes("INVALID_TRANSITION"))
    return new Error("Payroll must be processed before it can be marked as paid.");
  if (message.includes("INVALID_STATUS")) return new Error("That payroll status is not supported.");
  if (message.includes("duplicate key") || message.includes("payroll_records_employee_id"))
    return new Error("Payroll already exists for this employee and period.");
  if (message.includes("NO_EMPLOYEE_RECORD"))
    return new Error("We could not find an employee record for your account. Contact HR.");
  if (message.includes("NOT_FOUND")) return new Error("We could not find that payroll record.");
  return new Error("We could not complete the payroll operation. Please try again.");
}

/* ------------------------------------------------------- salary components */

/** Admin-only catalogue of configurable pay items. */
export const listSalaryComponents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ includeInactive: z.boolean().default(true) }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    let query = context.supabase
      .from("salary_components")
      .select(
        "id, code, name, component_type, calculation_method, default_value, description, is_active",
      )
      .order("component_type")
      .order("name");

    if (!data.includeInactive) query = query.eq("is_active", true);

    const { data: rows, error } = await query;
    if (error) throw new Error("We could not load the salary components.");
    return rows ?? [];
  });

/** Admin-only create/update of a salary component. */
export const saveSalaryComponent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salaryComponentSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: row, error } = await context.supabase.rpc("salary_component_save", {
      _id: data.id ?? (null as unknown as string),
      _code: data.code,
      _name: data.name,
      _component_type: data.componentType,
      _calculation_method: data.calculationMethod,
      _default_value: data.value,
      _is_active: data.isActive,
      _description: data.description ?? "",
    });

    if (error) throw friendlyError(error.message);

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "salary.component_changed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "salary_component",
      entityId: row?.id ?? null,
      summary: `Salary component ${data.code} ${data.id ? "updated" : "created"}`,
    });

    return row;
  });

/* ------------------------------------------------------- salary structures */

/**
 * Admin-only salary structure directory. Components come back with the row so
 * totals are derived once from the shared payroll rules instead of running a
 * query per employee.
 */
export const listSalaryStructures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        department: z.string().trim().max(120).optional(),
        onlyMissing: z.boolean().default(false),
        page: z.number().int().min(0).max(500).default(0),
        pageSize: z.number().int().min(5).max(100).default(25),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const from = data.page * data.pageSize;
    let query = context.supabase
      .from("employees")
      .select(
        `id, login_id, first_name, last_name, email, department, job_position, status,
         salary_structures(id, basic_salary, effective_from, currency, is_active,
           salary_structure_components(value, is_active,
             salary_components(id, code, name, component_type, calculation_method, is_active)))`,
        { count: "exact" },
      )
      .order("first_name")
      .range(from, from + data.pageSize - 1);

    if (data.department) query = query.eq("department", data.department);
    if (data.search) {
      const term = `%${data.search}%`;
      query = query.or(
        [
          `first_name.ilike.${term}`,
          `last_name.ilike.${term}`,
          `login_id.ilike.${term}`,
          `email.ilike.${term}`,
          `department.ilike.${term}`,
        ].join(","),
      );
    }

    const { data: rows, error, count } = await query;
    if (error) throw new Error("We could not load the salary structures.");

    const mapped = (rows ?? []).map((row) => {
      const structure = (row.salary_structures ?? []).find((item) => item.is_active) ?? null;
      return {
        employee_id: row.id,
        login_id: row.login_id,
        employee_name: `${row.first_name} ${row.last_name}`,
        email: row.email,
        department: row.department,
        job_position: row.job_position,
        employee_status: row.status,
        structure_id: structure?.id ?? null,
        basic_salary: structure?.basic_salary ?? 0,
        effective_from: structure?.effective_from ?? null,
        currency: structure?.currency ?? "INR",
        components: (structure?.salary_structure_components ?? [])
          .filter((link) => link.salary_components)
          .map((link) => ({
            component_id: link.salary_components!.id,
            code: link.salary_components!.code,
            name: link.salary_components!.name,
            component_type: link.salary_components!.component_type,
            calculation_method: link.salary_components!.calculation_method,
            value: link.value,
            is_active: link.is_active && link.salary_components!.is_active,
          })),
      };
    });

    const filtered = data.onlyMissing ? mapped.filter((row) => !row.structure_id) : mapped;
    return { rows: filtered, total: count ?? filtered.length };
  });

/** Admin-only structure detail with server-calculated totals. */
export const getSalaryStructure = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ employeeId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: detail, error } = await context.supabase.rpc("salary_structure_detail", {
      _employee_id: data.employeeId,
    });

    if (error) throw friendlyError(error.message);
    return detail;
  });

/** Admin-only create/assign/update of an employee salary structure. */
export const saveSalaryStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salaryStructureSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: row, error } = await context.supabase.rpc("salary_structure_save", {
      _employee_id: data.employeeId,
      _basic_salary: data.basicSalary,
      _effective_from: data.effectiveFrom,
      _components: data.components.map((item) => ({
        component_id: item.componentId,
        value: item.value,
        is_active: item.isActive,
      })),
      _notes: data.notes ?? "",
    });

    if (error) throw friendlyError(error.message);

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "salary.structure_changed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "employee",
      entityId: data.employeeId,
      summary: "Salary structure saved",
    });

    return row;
  });

/** The signed-in employee's own salary breakdown. Never accepts an employee id. */
export const getMySalaryStructure = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("my_salary_structure");
    if (error) throw friendlyError(error.message);
    return data;
  });

/* ----------------------------------------------------------------- payroll */

/**
 * Admin-only payroll preview. All salary maths, attendance context and
 * exception detection happen inside the database, so nothing the browser sends
 * can influence the amounts.
 */
export const previewPayroll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    payrollPeriodSchema.extend({ includeInactive: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: rows, error } = await context.supabase.rpc("payroll_preview", {
      _year: data.year,
      _month: data.month,
      _include_inactive: data.includeInactive,
    });

    if (error) throw friendlyError(error.message);

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "payroll.previewed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "payroll_period",
      entityId: `${data.year}-${String(data.month).padStart(2, "0")}`,
      summary: `Payroll preview opened for ${data.year}-${String(data.month).padStart(2, "0")} (${(rows ?? []).length} employee row(s))`,
    });

    return rows ?? [];
  });

/** Admin-only payroll generation for the confirmed employees. */
export const generatePayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => payrollGenerateSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: result, error } = await context.supabase.rpc("payroll_generate", {
      _year: data.year,
      _month: data.month,
      _employee_ids: data.employeeIds,
      _include_inactive: data.includeInactive,
    });

    if (error) throw friendlyError(error.message);

    const summary = (result ?? {}) as {
      period?: string;
      generated?: number;
      regenerated?: number;
      skipped?: number;
      exceptions?: { employee_name?: string; reason?: string }[];
    };

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "payroll.generated",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "payroll_period",
      entityId: `${data.year}-${String(data.month).padStart(2, "0")}`,
      summary: `Payroll run for ${summary.period ?? "period"}: ${summary.generated ?? 0} generated, ${summary.regenerated ?? 0} regenerated, ${(summary.exceptions ?? []).length} exception(s)`,
    });

    return summary;
  });

/** Admin-only status progression: GENERATED → PROCESSED → PAID. */
export const setPayrollStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => payrollStatusSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: row, error } = await context.supabase.rpc("payroll_set_status", {
      _id: data.id,
      _status: data.status,
    });

    if (error) throw friendlyError(error.message);

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "payroll.status_changed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "payroll_record",
      entityId: data.id,
      summary: `Payroll marked ${data.status.toLowerCase()}`,
    });

    return row;
  });

/** Admin-only payroll register with search, filters and pagination. */
export const listPayrollRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        year: z.number().int().min(2000).max(2100).optional(),
        month: z.number().int().min(1).max(12).optional(),
        status: z.enum(["DRAFT", "GENERATED", "PROCESSED", "PAID"]).optional(),
        department: z.string().trim().max(120).optional(),
        search: z.string().trim().max(120).optional(),
        page: z.number().int().min(0).max(500).default(0),
        pageSize: z.number().int().min(5).max(100).default(20),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const from = data.page * data.pageSize;
    let query = context.supabase
      .from("payroll_records")
      .select(`${PAYROLL_COLUMNS}, ${EMPLOYEE_JOIN}`, { count: "exact" })
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .order("generated_at", { ascending: false })
      .range(from, from + data.pageSize - 1);

    if (data.year) query = query.eq("period_year", data.year);
    if (data.month) query = query.eq("period_month", data.month);
    if (data.status) query = query.eq("status", data.status);
    if (data.department) query = query.eq("employees.department", data.department);

    if (data.search) {
      const term = `%${data.search}%`;
      query = query.or(
        [
          `first_name.ilike.${term}`,
          `last_name.ilike.${term}`,
          `login_id.ilike.${term}`,
          `department.ilike.${term}`,
        ].join(","),
        { referencedTable: "employees" },
      );
    }

    const { data: rows, error, count } = await query;
    if (error) throw new Error("We could not load the payroll records.");
    return { rows: rows ?? [], total: count ?? 0 };
  });

/** Admin-only payroll dashboard totals for a period. Calculated from real rows. */
export const getPayrollSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => payrollPeriodSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const [records, employees, preview] = await Promise.all([
      context.supabase
        .from("payroll_records")
        .select("gross_earnings, total_deductions, net_salary, status")
        .eq("period_year", data.year)
        .eq("period_month", data.month),
      context.supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .in("status", ["ACTIVE", "ON_LEAVE"]),
      context.supabase.rpc("payroll_preview", {
        _year: data.year,
        _month: data.month,
        _include_inactive: false,
      }),
    ]);

    if (records.error || employees.error || preview.error)
      throw new Error("We could not load the payroll summary.");

    const rows = records.data ?? [];
    const previewRows = preview.data ?? [];

    return {
      totalEmployees: employees.count ?? 0,
      eligibleEmployees: previewRows.filter((row) => !row.exception_reason).length,
      exceptions: previewRows.filter((row) => Boolean(row.exception_reason)).length,
      generated: rows.length,
      pending: Math.max((previewRows.filter((row) => !row.exception_reason).length ?? 0) - rows.length, 0),
      processed: rows.filter((row) => row.status === "PROCESSED").length,
      paid: rows.filter((row) => row.status === "PAID").length,
      totalGross: rows.reduce((sum, row) => sum + Number(row.gross_earnings ?? 0), 0),
      totalDeductions: rows.reduce((sum, row) => sum + Number(row.total_deductions ?? 0), 0),
      totalNet: rows.reduce((sum, row) => sum + Number(row.net_salary ?? 0), 0),
    };
  });

/**
 * A single payroll record. Row-level security decides visibility: employees can
 * only ever read their own record, so passing another id returns nothing.
 */
export const getPayrollRecord = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("payroll_records")
      .select(`${PAYROLL_COLUMNS}, ${EMPLOYEE_JOIN}`)
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error("We could not load that payroll record.");
    if (!row) throw new Error("This payslip is not available for your account.");
    return row;
  });

/** The signed-in employee's own payroll history. */
export const listMyPayrollRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: employee, error: employeeError } = await context.supabase
      .from("employees")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (employeeError) throw new Error("We could not load your payroll history.");
    if (!employee) return [];

    const { data: rows, error } = await context.supabase
      .from("payroll_records")
      .select(PAYROLL_COLUMNS)
      .eq("employee_id", employee.id)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false });

    if (error) throw new Error("We could not load your payroll history.");
    return rows ?? [];
  });

/* ------------------------------------------------------------ export trail */

const exportPeriodSchema = payrollPeriodSchema.extend({
  kind: z.enum(["SUMMARY", "REGISTER", "PAYSLIPS"]),
  recordCount: z.number().int().min(0).max(5000),
  /**
   * Stable key for one logical export attempt. A duplicate click or a retry of
   * a failed request reuses the key, so the export is recorded exactly once.
   */
  idempotencyKey: z.string().trim().min(8).max(120),
});

/**
 * Records an admin data export in the activity log. Called after the browser
 * builds the file, so the log always reflects a real download. No employee
 * data is written to the log — only counts and the period.
 */
export const recordPayrollExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => exportPeriodSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const label = `${data.year}-${String(data.month).padStart(2, "0")}`;

    // Claim the export first: the database rejects a second claim on the same
    // key, so repeated clicks and retries never duplicate the audit entry.
    const { data: claimed, error: claimError } = await context.supabase.rpc("export_job_claim", {
      _kind: `PAYROLL_${data.kind}`,
      _entity_label: label,
      _idempotency_key: data.idempotencyKey,
      _record_count: data.recordCount,
    });
    if (claimError) throw new Error("We could not record this export.");
    if (claimed !== true) return { ok: true, duplicate: true };

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: data.kind === "PAYSLIPS" ? "payroll.payslips_downloaded" : "payroll.exported",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "payroll_period",
      entityId: label,
      summary:
        data.kind === "PAYSLIPS"
          ? `Downloaded ${data.recordCount} payslip(s) for ${label} as a ZIP archive`
          : `Exported the payroll ${data.kind.toLowerCase()} for ${label} (${data.recordCount} row(s)) as CSV`,
    });

    return { ok: true, duplicate: false };
  });

/**
 * Every payroll record for a period, unpaged, for CSV and payslip exports.
 * Admin-gated on the server and in the database; the browser cannot widen it.
 */
export const listPayrollRecordsForExport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    payrollPeriodSchema
      .extend({ status: z.enum(["DRAFT", "GENERATED", "PROCESSED", "PAID"]).optional() })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    let query = context.supabase
      .from("payroll_records")
      .select(`${PAYROLL_COLUMNS}, ${EMPLOYEE_JOIN}`)
      .eq("period_year", data.year)
      .eq("period_month", data.month)
      .order("generated_at", { ascending: false })
      .limit(1000);

    if (data.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error("We could not load the payroll records for export.");
    return rows ?? [];
  });
