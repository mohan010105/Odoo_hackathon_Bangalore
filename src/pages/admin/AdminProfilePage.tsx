import { ChangePasswordCard } from "@/components/profile/ChangePasswordCard";
import { ProfileForm } from "@/components/profile/ProfileForm";

export function AdminProfilePage() {
  return (
    <div className="space-y-6">
      <ProfileForm
        title="My profile"
        description="Your HR administrator account details."
        canEditName
      />
      <ChangePasswordCard />
    </div>
  );
}
