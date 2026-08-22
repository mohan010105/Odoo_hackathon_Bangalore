import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { companySchema } from "@/lib/validation/employee";

/** The workspace company record (name + logo reference). */
export const getCompany = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("companies")
      .select("id, name, logo_url")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error("We could not load company details.");
    return data;
  });

/** Admin-only company update. Only the storage path is stored, never the file. */
export const saveCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => companySchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (isAdmin !== true) throw new Error("You are not authorised to perform this operation.");

    const { data: existing } = await context.supabase
      .from("companies")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const payload = {
      name: data.name,
      ...(data.logoPath ? { logo_url: data.logoPath } : {}),
    };

    const query = existing
      ? context.supabase.from("companies").update(payload).eq("id", existing.id)
      : context.supabase.from("companies").insert(payload);

    const { error } = await query;
    if (error) throw new Error("We could not save company details.");
    return { ok: true };
  });
