import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/rbac";
import { createEmployeeSchema } from "@/lib/validation/employee";

function getSupabaseConfig() {
  const url = (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "").trim();
  const key = (
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_ANON_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_ANON_KEY"] ||
    ""
  ).trim();
  return { url, key };
}

const EMPLOYEE_COLUMNS =
  "id, user_id, company_id, login_id, first_name, last_name, email, phone, joining_date, department, job_position, manager, location, profile_picture, status, created_at";

/** Admin-only employee directory. */
const listFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  department: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE"]).optional(),
});

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listFilterSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    let query = context.supabase
      .from("employees")
      .select(EMPLOYEE_COLUMNS)
      .order("created_at", { ascending: false });

    if (data.department) query = query.ilike("department", data.department);
    if (data.location) query = query.ilike("location", data.location);
    if (data.status) query = query.eq("status", data.status);

    if (data.search) {
      const term = `%${data.search}%`;
      query = query.or(
        [
          `first_name.ilike.${term}`,
          `last_name.ilike.${term}`,
          `email.ilike.${term}`,
          `login_id.ilike.${term}`,
          `department.ilike.${term}`,
          `job_position.ilike.${term}`,
          `location.ilike.${term}`,
        ].join(","),
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error("We could not load the employee directory.");
    return rows ?? [];
  });

/** Admin-only single employee record. */
export const getEmployeeById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { data: employee, error } = await context.supabase
      .from("employees")
      .select(EMPLOYEE_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error("We could not load this employee.");
    if (!employee) throw new Error("Employee not found.");
    return employee;
  });

/** The signed-in employee's own record (RLS restricts this to their row). */
export const getMyEmployeeRecord = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("employees")
      .select(EMPLOYEE_COLUMNS)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error) throw new Error("We could not load your employee record.");
    return data;
  });

/**
 * Admin employee provisioning: generates the Login ID (database-side, unique),
 * a cryptographically random temporary password, creates the login account and
 * the employee record, and returns the credentials exactly once.
 */
export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createEmployeeSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateTemporaryPassword } = await import("@/lib/security/credentials.server");

    const { data: existing } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();

    if (existing) {
      throw new Error("An employee with this email already exists.");
    }

    const { data: loginId, error: loginIdError } = await supabaseAdmin.rpc(
      "generate_employee_login_id",
      {
        _first_name: data.firstName,
        _last_name: data.lastName,
        _joining_date: data.joiningDate,
      },
    );

    if (loginIdError || !loginId) {
      throw new Error("We could not generate a Login ID. Please try again.");
    }

    const temporaryPassword = generateTemporaryPassword();
    const fullName = `${data.firstName} ${data.lastName}`.trim();

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: temporaryPassword,
      // The employee must verify their email address before they can sign in.
      email_confirm: false,
      user_metadata: { full_name: fullName, login_id: loginId },
    });

    if (createError || !created.user) {
      throw new Error(
        createError?.message?.toLowerCase().includes("already")
          ? "An account with this email already exists."
          : "We could not create the employee login account.",
      );
    }

    const userId = created.user.id;

    const rollback = async (message: string) => {
      await supabaseAdmin.from("employees").delete().eq("user_id", userId);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(message);
    };

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      email: data.email,
      full_name: fullName,
      must_change_password: true,
    });
    if (profileError) await rollback("We could not finish creating this employee.");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "EMPLOYEE" });
    if (roleError) await rollback("We could not assign the employee role.");

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .insert({
        user_id: userId,
        login_id: loginId,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone ?? null,
        joining_date: data.joiningDate,
        department: data.department ?? null,
        job_position: data.jobPosition ?? null,
        manager: data.manager ?? null,
        location: data.location ?? null,
        profile_picture: data.profilePicturePath ?? null,
        company_id: data.companyId ?? null,
        status: "INACTIVE",
      })
      .select(EMPLOYEE_COLUMNS)
      .single();

    if (employeeError || !employee) {
      await rollback(
        employeeError?.message?.includes("employees_login_id_key")
          ? "Login ID collision detected. Please try again."
          : "We could not save the employee record.",
      );
    }

    // Send the verification email the employee must confirm before first sign-in.
    const { createClient } = await import("@supabase/supabase-js");
    const { url, key } = getSupabaseConfig();
    const anonClient = createClient(
      url,
      key,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { error: verificationError } = await anonClient.auth.resend({
      type: "signup",
      email: data.email,
      ...(data.verificationRedirectTo
        ? { options: { emailRedirectTo: data.verificationRedirectTo } }
        : {}),
    });
    if (verificationError) {
      console.error("[auth] could not send employee verification email", verificationError.message);
    }

    const { recordAuditEvent, maskEmail } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "employee.created",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "employee",
      entityId: employee!.id,
      summary: `Created employee ${loginId} (${maskEmail(data.email)}) — verification email sent`,
    });

    // The plaintext password is returned once and never stored by Dayflow.
    return {
      employee: employee!,
      loginId,
      temporaryPassword,
      verificationRequired: true,
    };
  });

/** Admin-only: re-send the verification email for an employee who never confirmed. */
export const resendEmployeeVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().trim().email(), redirectTo: z.string().url() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase);

    const { createClient } = await import("@supabase/supabase-js");
    const { url, key } = getSupabaseConfig();
    const client = createClient(
      url,
      key,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    await client.auth.resend({
      type: "signup",
      email: data.email,
      options: { emailRedirectTo: data.redirectTo },
    });

    const { recordAuditEvent, maskEmail } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "employee.verification_resent",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "employee",
      entityId: data.email,
      summary: `Re-sent verification email to ${maskEmail(data.email)}`,
    });

    return { ok: true };
  });
