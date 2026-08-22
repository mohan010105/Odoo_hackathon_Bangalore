import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AuthLayout } from "@/layouts/AuthLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";

/**
 * Landing page for the emailed recovery link. Supabase places a recovery
 * session on this page, which is only used to set a new password.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setHasRecoverySession(!!data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setHasRecoverySession(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ResetPasswordInput) => {
    const { error } = await supabase.auth.updateUser({ password: values.newPassword });
    if (error) {
      toast.error("We could not update your password", { description: error.message });
      return;
    }
    await supabase.auth.signOut();
    toast.success("Password updated. Please sign in with your new password.");
    navigate({ to: "/login", replace: true });
  };

  return (
    <AuthLayout
      title="Set a new password"
      description="Choose a strong password you have not used before."
      footer={<Link to="/login">Back to sign in</Link>}
    >
      {hasRecoverySession === false ? (
        <Alert variant="destructive">
          <AlertTitle>This reset link is not valid</AlertTitle>
          <AlertDescription>
            The link may have expired or already been used. Request a new one from the{" "}
            <Link to="/forgot-password" className="underline">
              forgot password
            </Link>{" "}
            page.
          </AlertDescription>
        </Alert>
      ) : (
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.newPassword}
              {...form.register("newPassword")}
            />
            {form.formState.errors.newPassword ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.newPassword.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.confirmPassword}
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting || hasRecoverySession === null}
          >
            {form.formState.isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
