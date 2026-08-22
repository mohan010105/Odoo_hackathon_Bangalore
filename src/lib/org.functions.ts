import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/rbac";

const DEPARTMENT_COLUMNS = "id, name, code, description, is_active, created_at";
const POSITION_COLUMNS = "id, title, department_id, description, is_active, created_at";
const PRIVATE_COLUMNS =
  "id, employee_id, date_of_birth, gender, marital_status, personal_email, personal_phone, address_line1, address_line2, city, state, postal_code, country, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, bank_name, bank_account_number, bank_ifsc, tax_id, national_id, notes, updated_at";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined));

export const departmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Enter a department name").max(120),
  code: optionalText(20),
  description: optionalText(400),
  isActive: z.boolean().default(true),
});

export const jobPositionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Enter a position title").max(120),
  departmentId: z.string().uuid().optional(),
  description: optionalText(400),
  isActive: z.boolean().default(true),
});

export const employeePrivateInfoSchema = z.object({
  employeeId: z.string().uuid(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
  gender: optionalText(30),
  maritalStatus: optionalText(30),
  personalEmail: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
  personalPhone: optionalText(30),
  addressLine1: optionalText(160),
  addressLine2: optionalText(160),
  city: optionalText(80),
  state: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(80),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalText(30),
  emergencyContactRelation: optionalText(60),
  bankName: optionalText(120),
  bankAccountNumber: optionalText(40),
  bankIfsc: optionalText(20),
  taxId: optionalText(40),
  nationalId: optionalText(40),
  notes: optionalText(600),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type JobPositionInput = z.infer<typeof jobPositionSchema>;
export type EmployeePrivateInfoInput = z.infer<typeof employeePrivateInfoSchema>;

function friendlyOrgError(message: string): Error {
  if (message.includes("departments_name_key"))
    return new Error("A department with that name already exists.");
  if (message.includes("job_positions_title_dept_key"))
    return new Error("That position already exists for this department.");
  if (message.toLowerCase().includes("row-level security") || message.includes("permission"))
    return new Error("You are not authorised to change the organisation structure.");
  return new Error("We could not save that change. Please try again.");
}

/* ------------------------------------------------------------- departments */

/** Department list. Readable by any signed-in user so dropdowns work. */
export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ includeInactive: z.boolean().default(true) }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("departments")
      .select(`${DEPARTMENT_COLUMNS}, employees(count)`)
      .order("name");
    if (!data.includeInactive) query = query.eq("is_active", true);

    const { data: rows, error } = await query;
    if (error) throw new Error("We could not load the departments.");

    return (rows ?? []).map((row) => {
      const { employees, ...rest } = row as typeof row & {
        employees?: { count: number }[] | null;
      };
      return { ...rest, headcount: employees?.[0]?.count ?? 0 };
    });
  });

/** Admin-only create/update of a department. */
export const saveDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => departmentSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const payload = {
      name: data.name,
      code: data.code ?? null,
      description: data.description ?? null,
      is_active: data.isActive,
    };

    const query = data.id
      ? context.supabase.from("departments").update(payload).eq("id", data.id)
      : context.supabase.from("departments").insert(payload);

    const { data: row, error } = await query.select(DEPARTMENT_COLUMNS).single();
    if (error) throw friendlyOrgError(error.message);

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "org.department_changed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "department",
      entityId: row.id,
      summary: `Department ${data.name} ${data.id ? "updated" : "created"}`,
    });

    return row;
  });

/** Admin-only department removal. Employees keep their free-text department. */
export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { error } = await context.supabase.from("departments").delete().eq("id", data.id);
    if (error) throw new Error("We could not remove that department.");

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "org.department_removed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "department",
      entityId: data.id,
      summary: "Department removed",
    });

    return { ok: true };
  });

/* ---------------------------------------------------------- job positions */

/** Job position list with the parent department name. */
export const listJobPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        includeInactive: z.boolean().default(true),
        departmentId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("job_positions")
      .select(`${POSITION_COLUMNS}, departments(id, name)`)
      .order("title");
    if (!data.includeInactive) query = query.eq("is_active", true);
    if (data.departmentId) query = query.eq("department_id", data.departmentId);

    const { data: rows, error } = await query;
    if (error) throw new Error("We could not load the job positions.");
    return rows ?? [];
  });

/** Admin-only create/update of a job position. */
export const saveJobPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => jobPositionSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const payload = {
      title: data.title,
      department_id: data.departmentId ?? null,
      description: data.description ?? null,
      is_active: data.isActive,
    };

    const query = data.id
      ? context.supabase.from("job_positions").update(payload).eq("id", data.id)
      : context.supabase.from("job_positions").insert(payload);

    const { data: row, error } = await query.select(POSITION_COLUMNS).single();
    if (error) throw friendlyOrgError(error.message);

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "org.position_changed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "job_position",
      entityId: row.id,
      summary: `Job position ${data.title} ${data.id ? "updated" : "created"}`,
    });

    return row;
  });

/** Admin-only job position removal. */
export const deleteJobPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { error } = await context.supabase.from("job_positions").delete().eq("id", data.id);
    if (error) throw new Error("We could not remove that job position.");

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "org.position_removed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "job_position",
      entityId: data.id,
      summary: "Job position removed",
    });

    return { ok: true };
  });

/* ------------------------------------------------- confidential employee info */

/**
 * Confidential record for one employee. Row-level security decides visibility:
 * an employee only ever reads their own row, admin/HR read any row.
 */
export const getEmployeePrivateInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ employeeId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("employee_private_info")
      .select(PRIVATE_COLUMNS)
      .eq("employee_id", data.employeeId)
      .maybeSingle();

    if (error) throw new Error("We could not load the confidential employee details.");
    return row;
  });

/** The signed-in employee's own confidential record. Never accepts an id. */
export const getMyPrivateInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: employee } = await context.supabase
      .from("employees")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!employee) return null;

    const { data: row, error } = await context.supabase
      .from("employee_private_info")
      .select(PRIVATE_COLUMNS)
      .eq("employee_id", employee.id)
      .maybeSingle();

    if (error) throw new Error("We could not load your confidential details.");
    return row;
  });

/** Admin-only upsert of a confidential employee record. */
export const saveEmployeePrivateInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => employeePrivateInfoSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const payload = {
      employee_id: data.employeeId,
      date_of_birth: data.dateOfBirth ?? null,
      gender: data.gender ?? null,
      marital_status: data.maritalStatus ?? null,
      personal_email: data.personalEmail ?? null,
      personal_phone: data.personalPhone ?? null,
      address_line1: data.addressLine1 ?? null,
      address_line2: data.addressLine2 ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      postal_code: data.postalCode ?? null,
      country: data.country ?? null,
      emergency_contact_name: data.emergencyContactName ?? null,
      emergency_contact_phone: data.emergencyContactPhone ?? null,
      emergency_contact_relation: data.emergencyContactRelation ?? null,
      bank_name: data.bankName ?? null,
      bank_account_number: data.bankAccountNumber ?? null,
      bank_ifsc: data.bankIfsc ?? null,
      tax_id: data.taxId ?? null,
      national_id: data.nationalId ?? null,
      notes: data.notes ?? null,
    };

    const { data: row, error } = await context.supabase
      .from("employee_private_info")
      .upsert(payload, { onConflict: "employee_id" })
      .select(PRIVATE_COLUMNS)
      .single();

    if (error) throw friendlyOrgError(error.message);

    // Audit records the fact of the change only — never the values themselves.
    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "employee.private_info_changed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "employee",
      entityId: data.employeeId,
      summary: "Confidential employee details updated",
    });

    return row;
  });
