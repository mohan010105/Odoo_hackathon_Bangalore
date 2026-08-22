import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { ProfileCompletionCard } from "@/components/profile/ProfileCompletionCard";
import { ErrorState, LoadingState } from "@/components/common/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { evaluateProfileCompletion } from "@/lib/profile/completion";
import { profileService } from "@/services/profile/profileService";

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Shared "My profile" editor.
 *
 * Employees can change their picture and contact details only — name,
 * department, position and joining date stay HR-managed. Administrators can
 * also correct their own display name.
 */
export function ProfileForm({
  title,
  description,
  canEditName,
  readOnlyDetails,
}: {
  title: string;
  description: string;
  canEditName: boolean;
  readOnlyDetails?: { label: string; value: string }[];
}) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [picture, setPicture] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => profileService.getMyProfile(),
  });

  useEffect(() => {
    if (!profile.data) return;
    setFullName(profile.data.fullName ?? "");
    setPhone(profile.data.phone ?? "");
    setLocation(profile.data.location ?? "");
  }, [profile.data]);

  useEffect(() => {
    if (!picture) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(picture);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [picture]);

  const onSave = async () => {
    if (canEditName && fullName.trim().length < 2) {
      toast.error("Enter your full name");
      return;
    }
    if (phone.trim().length > 0 && phone.trim().length < 6) {
      toast.error("Enter a phone number we can reach you on");
      return;
    }
    setIsSaving(true);
    try {
      const avatarPath = picture ? await profileService.uploadPicture(picture) : undefined;
      await profileService.save({
        ...(canEditName ? { fullName: fullName.trim() } : {}),
        phone: phone.trim(),
        location: location.trim(),
        ...(avatarPath ? { avatarPath } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["my-employee-record"] });
      setPicture(null);
      toast.success("Profile updated");
    } catch (cause) {
      toast.error("Could not save your profile", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (profile.isLoading) return <LoadingState label="Loading your profile…" />;
  if (profile.isError || !profile.data) {
    return (
      <ErrorState
        description="We could not load your profile."
        onRetry={() => void profile.refetch()}
      />
    );
  }

  const data = profile.data;
  const completion = evaluateProfileCompletion({
    fullName,
    email: data.email,
    phone,
    location,
    avatarUrl: picture ? "pending-upload" : data.avatarUrl,
  });
  const missing = (id: string) =>
    completion.missingRequired.some((field) => field.id === id);

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <ProfileCompletionCard completion={completion} />

      <section aria-labelledby="picture-heading" className="rounded-xl border bg-card p-5">
        <h2 id="picture-heading" className="text-sm font-semibold">
          Profile picture
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Avatar className="size-20">
            <AvatarImage
              src={previewUrl ?? data.avatarUrl ?? undefined}
              alt={`${data.fullName ?? data.email} profile picture`}
            />
            <AvatarFallback>{initials(data.fullName, data.email)}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Choose a profile picture"
              onChange={(event) => setPicture(event.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInput.current?.click()}
            >
              {picture ? "Change selected image" : "Upload new picture"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {picture ? picture.name : "PNG, JPG or WebP. Saved when you press Save changes."}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="details-heading" className="rounded-xl border bg-card p-5">
        <h2 id="details-heading" className="text-sm font-semibold">
          Basic details
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              disabled={!canEditName}
              aria-invalid={missing("fullName")}
              className={missing("fullName") && canEditName ? "border-destructive" : undefined}
              onChange={(event) => setFullName(event.target.value)}
            />
            {!canEditName ? (
              <p className="text-xs text-muted-foreground">
                Your name is managed by HR. Contact your administrator to change it.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" value={data.email} disabled readOnly />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              inputMode="tel"
              required
              aria-invalid={missing("phone")}
              aria-describedby={missing("phone") ? "phone-required" : undefined}
              className={missing("phone") ? "border-destructive" : undefined}
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            {missing("phone") ? (
              <p id="phone-required" className="text-xs text-destructive">
                Required — add a contact number.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="Bengaluru, IN"
              required
              aria-invalid={missing("location")}
              aria-describedby={missing("location") ? "location-required" : undefined}
              className={missing("location") ? "border-destructive" : undefined}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            {missing("location") ? (
              <p id="location-required" className="text-xs text-destructive">
                Required — add your city and country.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <Button type="button" onClick={() => void onSave()} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </section>

      {readOnlyDetails && readOnlyDetails.length > 0 ? (
        <section aria-labelledby="job-heading" className="rounded-xl border bg-card p-5">
          <h2 id="job-heading" className="text-sm font-semibold">
            Job details
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {readOnlyDetails.map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="text-sm font-medium">{item.value || "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">These fields are maintained by HR.</p>
        </section>
      ) : null}
    </div>
  );
}
