import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { signStoragePaths } from "@/lib/storage.functions";
import { companyService } from "@/services/company/companyService";

export type MyProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  location: string | null;
  avatarPath: string | null;
  /** Short-lived signed URL for the stored profile picture. */
  avatarUrl: string | null;
};

export const profileService = {
  async getMyProfile(): Promise<MyProfile | null> {
    const row = await getMyProfile({});
    if (!row) return null;

    let avatarUrl: string | null = null;
    if (row.avatar_url) {
      try {
        const signed = await signStoragePaths({
          data: { bucket: "profile-pictures", paths: [row.avatar_url] },
        });
        avatarUrl = signed[row.avatar_url] ?? null;
      } catch {
        avatarUrl = null;
      }
    }

    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name ?? null,
      phone: row.phone ?? null,
      location: row.location ?? null,
      avatarPath: row.avatar_url ?? null,
      avatarUrl,
    };
  },

  uploadPicture(file: File) {
    return companyService.uploadProfilePicture(file);
  },

  async save(input: { fullName?: string; phone?: string; location?: string; avatarPath?: string }) {
    await updateMyProfile({
      data: {
        fullName: input.fullName ?? "",
        phone: input.phone ?? "",
        location: input.location ?? "",
        avatarPath: input.avatarPath ?? "",
      },
    });
  },
};
