import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { toast } from "sonner";

import { PasswordStrengthMeter } from "@/components/profile/PasswordStrengthMeter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/auth";

/**
 * In-app password change for the signed-in user. The current password is
 * re-verified against the auth provider before the update, and the new value
 * never touches our own tables — only the auth provider stores credentials.
 *
 * Validation runs as the user types so every requirement is visible before
 * submitting: no guesswork, no server round-trip to discover a weak password.
 */
export function ChangePasswordCard() {
  const { changePassword } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onChange",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const newPassword = form.watch("newPassword");

  const onSubmit = async (values: ChangePasswordInput) => {
    setFormError(null);
    try {
      await changePassword(values);
      form.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password updated", { description: "Use your new password next time." });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We could not update your password.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Change password</CardTitle>
        <CardDescription>
          Confirm your current password, then choose a new one that meets every requirement below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 sm:max-w-md"
          aria-label="Change password"
        >
          {(
            [
              ["currentPassword", "Current password", "current-password"],
              ["newPassword", "New password", "new-password"],
              ["confirmPassword", "Confirm new password", "new-password"],
            ] as const
          ).map(([name, label, autoComplete]) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={`profile-${name}`}>{label}</Label>
              <Input
                id={`profile-${name}`}
                type="password"
                autoComplete={autoComplete}
                aria-invalid={!!form.formState.errors[name]}
                aria-describedby={
                  name === "newPassword"
                    ? "profile-password-rules"
                    : form.formState.errors[name]
                      ? `profile-${name}-error`
                      : undefined
                }
                {...form.register(name)}
              />
              {name === "newPassword" ? (
                <PasswordStrengthMeter id="profile-password-rules" value={newPassword ?? ""} />
              ) : null}
              {form.formState.errors[name] ? (
                <p id={`profile-${name}-error`} role="alert" className="text-sm text-destructive">
                  {form.formState.errors[name]?.message}
                </p>
              ) : null}
            </div>
          ))}

          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <Button
            type="submit"
            className="sm:w-fit"
            disabled={form.formState.isSubmitting || !form.formState.isValid}
          >
            {form.formState.isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
