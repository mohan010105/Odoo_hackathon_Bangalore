import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { homeRouteForRole } from "@/lib/permissions";
import { signInSchema, type SignInInput } from "@/lib/validation/auth";

export function LoginPage() {
  const { signIn, error } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const submitting = form.formState.isSubmitting;

  const onSubmit = async (values: SignInInput) => {
    try {
      const user = await signIn(values);
      if (user.role === "EMPLOYEE" && user.mustChangePassword) {
        navigate({ to: "/change-password", replace: true });
        return;
      }
      navigate({ to: homeRouteForRole(user.role), replace: true });
    } catch {
      // Error message is surfaced through auth context state.
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to continue to Dayflow."
      footer="Access is provided by your HR administrator."
    >
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="identifier">Login ID or work email</Label>
          <Input
            id="identifier"
            autoComplete="username"
            placeholder="MORA20260001"
            aria-invalid={!!form.formState.errors.identifier}
            aria-describedby={form.formState.errors.identifier ? "identifier-error" : undefined}
            {...form.register("identifier")}
          />
          {form.formState.errors.identifier ? (
            <p id="identifier-error" role="alert" className="text-sm text-destructive">
              {form.formState.errors.identifier.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
              aria-invalid={!!form.formState.errors.password}
              aria-describedby={form.formState.errors.password ? "password-error" : undefined}
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
          {form.formState.errors.password ? (
            <p id="password-error" role="alert" className="text-sm text-destructive">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {/* Disabled while submitting so authentication cannot be double-fired. */}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
