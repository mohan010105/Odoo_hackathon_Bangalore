import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AuthLayout } from "@/layouts/AuthLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { homeRouteForRole } from "@/lib/permissions";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/auth";

export function ChangePasswordPage() {
  const { user, isLoading, changePassword, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: "/login", replace: true });
  }, [isLoading, user, navigate]);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ChangePasswordInput) => {
    try {
      await changePassword(values);
      toast.success("Password updated", { description: "Use your new password from now on." });
      navigate({ to: homeRouteForRole(user?.role ?? "EMPLOYEE"), replace: true });
    } catch {
      // Error surfaced through auth context state.
    }
  };

  const isFirstLogin = !!user?.mustChangePassword;

  return (
    <AuthLayout
      title={isFirstLogin ? "Set your own password" : "Change your password"}
      description={
        isFirstLogin
          ? "Your account was created with a temporary password. Choose a new one to continue."
          : "Choose a new password for your Dayflow account."
      }
    >
      {isFirstLogin ? (
        <Alert className="mb-5">
          <AlertTitle>Required before you continue</AlertTitle>
          <AlertDescription>
            For security, the password issued by HR must be replaced before you can use your
            workspace.
          </AlertDescription>
        </Alert>
      ) : null}

      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {(
          [
            [
              "currentPassword",
              isFirstLogin ? "Temporary password" : "Current password",
              "current-password",
            ],
            ["newPassword", "New password", "new-password"],
            ["confirmPassword", "Confirm new password", "new-password"],
          ] as const
        ).map(([name, label, autoComplete]) => (
          <div key={name} className="space-y-2">
            <Label htmlFor={name}>{label}</Label>
            <Input
              id={name}
              type="password"
              autoComplete={autoComplete}
              aria-invalid={!!form.formState.errors[name]}
              aria-describedby={form.formState.errors[name] ? `${name}-error` : undefined}
              {...form.register(name)}
            />
            {form.formState.errors[name] ? (
              <p id={`${name}-error`} role="alert" className="text-sm text-destructive">
                {form.formState.errors[name]?.message}
              </p>
            ) : null}
          </div>
        ))}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
