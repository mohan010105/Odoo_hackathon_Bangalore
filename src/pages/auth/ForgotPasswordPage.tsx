import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthLayout } from "@/layouts/AuthLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth.functions";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    // The response is identical whether or not the address exists.
    await requestPasswordReset({
      data: {
        email: values.email,
        redirectTo: `${window.location.origin}/reset-password`,
      },
    }).catch(() => undefined);
    setSent(true);
  };

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter the work email on your Dayflow account and we will send a reset link."
      footer={<Link to="/login">Back to sign in</Link>}
    >
      {sent ? (
        <Alert>
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If that email is registered with Dayflow, a password reset link is on its way. The link
            expires shortly for your security.
          </AlertDescription>
        </Alert>
      ) : (
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!form.formState.errors.email}
              aria-describedby={form.formState.errors.email ? "email-error" : undefined}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p id="email-error" role="alert" className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Reset links are sent by email only. If you do not know your work email, contact your
              HR administrator.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
