import { supabase } from "@/integrations/supabase/client";
import { getCompany, saveCompany } from "@/lib/company.functions";
import { signStoragePaths } from "@/lib/storage.functions";

export type CompanyDetails = {
  id: string;
  name: string;
  /** Storage path of the logo, if one has been uploaded. */
  logoPath: string | null;
  /** Short-lived signed URL for previewing the logo. */
  logoUrl: string | null;
};

const BUCKET = "company-logos";

export const companyService = {
  async getCompany(): Promise<CompanyDetails | null> {
    const row = await getCompany({});
    if (!row) return null;

    let logoUrl: string | null = null;
    if (row.logo_url) {
      try {
        const signed = await signStoragePaths({ data: { bucket: BUCKET, paths: [row.logo_url] } });
        logoUrl = signed[row.logo_url] ?? null;
      } catch {
        logoUrl = null;
      }
    }

    return { id: row.id, name: row.name, logoPath: row.logo_url ?? null, logoUrl };
  },

  /** Uploads the logo file to storage and returns its stored path. */
  async uploadLogo(file: File): Promise<string> {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `logo-${Date.now()}.${extension}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) throw new Error("We could not upload that logo. Please try again.");
    return path;
  },

  async uploadProfilePicture(file: File): Promise<string> {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const { error } = await supabase.storage
      .from("profile-pictures")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) throw new Error("We could not upload that picture. Please try again.");
    return path;
  },

  async save(name: string, logoPath?: string) {
    await saveCompany({ data: { name, ...(logoPath ? { logoPath } : {}) } });
  },
};
