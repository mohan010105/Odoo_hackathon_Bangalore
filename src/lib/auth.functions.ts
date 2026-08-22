import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bootstrapAdminSchema, signInSchema } from "@/lib/validation/auth";

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

/**
 * Signs in with either a Login ID or an email address.
 *
 * The Login ID → email mapping happens entirely server-side (through a
 * restricted database function), so no employee email is ever disclosed to an
 * unauthenticated client. Only session tokens are returned.
 *
 * Accounts whose email address has not been verified are refused here, so an
 * unverified user can never obtain a session.
 */
export const signInWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signInSchema.parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordAuditEvent, maskEmail } = await import("@/lib/audit.server");

    const identifier = data.identifier.trim();
    let email = identifier;

    if (!identifier.includes("@")) {
      const { data: resolved } = await supabaseAdmin.rpc("email_for_login_id", {
        _login_id: identifier,
      });
      if (!resolved) {
        await recordAuditEvent({
          action: "auth.login_failed",
          summary: "Sign-in attempt with an unknown Login ID",
        });
        throw new Error("Invalid Employee ID or password.");
      }
      email = resolved;
    }

    const { url, key } = getSupabaseConfig();
    const client = createClient(
      url,
      key,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: signIn, error } = await client.auth.signInWithPassword({
      email,
      password: data.password,
    });

    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      if (message.includes("not confirmed") || message.includes("email not confirmed")) {
        await recordAuditEvent({
          action: "auth.login_blocked_unverified",
          actorEmail: email,
          summary: `Sign-in blocked: email not verified (${maskEmail(email)})`,
        });
        throw new Error(
          "Verify your email address before signing in. Check your inbox for the verification link.",
        );
      }
      await recordAuditEvent({
        action: "auth.login_failed",
        actorEmail: email,
        summary: `Failed sign-in attempt for ${maskEmail(email)}`,
      });
      throw new Error("Invalid Employee ID or password.");
    }

    if (!signIn.session || !signIn.user) {
      throw new Error("Invalid Employee ID or password.");
    }

    if (!signIn.user.email_confirmed_at) {
      await client.auth.signOut();
      await recordAuditEvent({
        action: "auth.login_blocked_unverified",
        actorId: signIn.user.id,
        actorEmail: email,
        summary: `Sign-in blocked: email not verified (${maskEmail(email)})`,
      });
      throw new Error(
        "Verify your email address before signing in. Check your inbox for the verification link.",
      );
    }

    await recordAuditEvent({
      action: "auth.login",
      actorId: signIn.user.id,
      actorEmail: email,
      summary: `Signed in as ${maskEmail(email)}`,
    });

    return {
      accessToken: signIn.session.access_token,
      refreshToken: signIn.session.refresh_token,
    };
  });

/** Clears the first-login password requirement for the signed-in user. */
export const markPasswordChanged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", context.userId);

    if (error) throw new Error("We could not confirm your password change. Please try again.");

    // First sign-in completes onboarding, so the employee record becomes active.
    // Employees cannot update their own record under RLS, hence the admin client
    // scoped strictly to the caller's own user id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("employees")
      .update({ status: "ACTIVE" })
      .eq("user_id", context.userId)
      .eq("status", "INACTIVE");

    const { recordAuditEvent } = await import("@/lib/audit.server");
    await recordAuditEvent({
      action: "password.changed",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      summary: "Password changed",
    });

    return { ok: true };
  });

/**
 * Sends a password reset link. Always returns the same response so the endpoint
 * can never be used to discover which email addresses are registered.
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email("Enter a valid email address"),
        redirectTo: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { recordAuditEvent, maskEmail } = await import("@/lib/audit.server");

    const { url, key } = getSupabaseConfig();
    const client = createClient(
      url,
      key,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    await client.auth.resetPasswordForEmail(data.email, { redirectTo: data.redirectTo });

    await recordAuditEvent({
      action: "password.reset_requested",
      actorEmail: data.email,
      summary: `Password reset requested for ${maskEmail(data.email)}`,
    });

    return { ok: true };
  });

/** Re-sends the email verification link. Response never reveals account state. */
export const resendVerificationEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email("Enter a valid email address"),
        redirectTo: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
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

    return { ok: true };
  });

/** True while no HR administrator exists yet — enables the one-time setup route. */
export const adminBootstrapAvailable = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "ADMIN");

  if (error) throw new Error("Setup status is unavailable right now.");
  return { available: (count ?? 0) === 0 };
});

/**
 * One-time controlled bootstrap of the first HR administrator. It refuses to run
 * once any administrator exists, so this is never a public admin sign-up. The
 * administrator must verify their email address before they can sign in.
 */
export const bootstrapAdminAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bootstrapAdminSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "ADMIN");

    if ((count ?? 0) > 0) {
      throw new Error("An administrator already exists. Sign in instead.");
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: false,
      user_metadata: { full_name: data.fullName },
    });

    if (createError || !created.user) {
      throw new Error(
        createError?.message?.toLowerCase().includes("already")
          ? "An account with this email already exists."
          : "We could not create the administrator account.",
      );
    }

    const userId = created.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({ id: userId, email: data.email, full_name: data.fullName });
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "ADMIN" });

    if (profileError || roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("We could not finish administrator setup. Please try again.");
    }

    await supabaseAdmin.from("companies").insert({ name: data.companyName });

    // Send the verification email the administrator must confirm before signing in.
    const { createClient } = await import("@supabase/supabase-js");
    const { url, key } = getSupabaseConfig();
    const client = createClient(
      url,
      key,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { error: resendError } = await client.auth.resend({
      type: "signup",
      email: data.email,
      ...(data.redirectTo ? { options: { emailRedirectTo: data.redirectTo } } : {}),
    });
    if (resendError) {
      console.error("[auth] could not send admin verification email", resendError.message);
    }

    return { ok: true, verificationRequired: true };
  });
