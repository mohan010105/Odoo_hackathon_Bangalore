import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null));

/**
 * Employees may only maintain their picture and contact details; name,
 * department, position and joining date stay admin-managed. Administrators may
 * additionally correct their own display name.
 */
const updateSchema = z.object({
  fullName: optionalText(120),
  phone: optionalText(30),
  location: optionalText(120),
  avatarPath: optionalText(300),
});

export type UpdateMyProfileInput = z.input<typeof updateSchema>;

/** The signed-in user's own profile (any role). */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, phone, location, avatar_url, must_change_password, created_at")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) throw new Error("We could not load your profile.");
    return data;
  });

/** Updates the caller's own profile only — the user id is taken from the token. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { isAdmin } = await import("@/lib/rbac");
    const { recordAuditEvent } = await import("@/lib/audit.server");

    const callerIsAdmin = await isAdmin(context.supabase);

    const profilePatch: {
      phone: string | null;
      location: string | null;
      avatar_url?: string | null;
      full_name?: string | null;
    } = {
      phone: data.phone,
      location: data.location,
    };
    if (data.avatarPath !== null) profilePatch.avatar_url = data.avatarPath;
    // Employees cannot rename themselves; HR administrators own their own name.
    if (callerIsAdmin && data.fullName !== null) profilePatch.full_name = data.fullName;

    const { error } = await context.supabase
      .from("profiles")
      .update(profilePatch)
      .eq("id", context.userId);

    if (error) throw new Error("We could not save your profile. Please try again.");

    // Mirror the editable fields onto the employee record when one exists.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const employeePatch: {
      phone: string | null;
      location: string | null;
      profile_picture?: string | null;
    } = {
      phone: data.phone,
      location: data.location,
    };
    if (data.avatarPath !== null) employeePatch.profile_picture = data.avatarPath;

    await supabaseAdmin.from("employees").update(employeePatch).eq("user_id", context.userId);

    await recordAuditEvent({
      action: "profile.updated",
      actorId: context.userId,
      actorEmail: typeof context.claims.email === "string" ? context.claims.email : null,
      entityType: "profile",
      entityId: context.userId,
      summary: "Updated own profile details",
    });

    return { ok: true };
  });
