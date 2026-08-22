import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const bucketSchema = z.enum(["company-logos", "profile-pictures", "leave-attachments"]);

/**
 * Buckets are private, so files are read through short-lived signed URLs.
 * Only signed-in users can request them.
 */
export const signStoragePaths = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ bucket: bucketSchema, paths: z.array(z.string().min(1)).max(200) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    if (data.paths.length === 0) return {} as Record<string, string>;

    const { data: signed, error } = await context.supabase.storage
      .from(data.bucket)
      .createSignedUrls(data.paths, 60 * 60);

    if (error) throw new Error("We could not load these files.");

    const result: Record<string, string> = {};
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) result[item.path] = item.signedUrl;
    }
    return result;
  });
