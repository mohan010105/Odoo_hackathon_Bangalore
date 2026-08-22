import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AuthLayout } from "@/layouts/AuthLayout";
import { LoadingState } from "@/components/common/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { adminBootstrapAvailable, bootstrapAdminAccount } from "@/lib/auth.functions";
import { bootstrapAdminSchema, type BootstrapAdminInput } from "@/lib/validation/auth";

/**
 * One-time HR administrator setup. Self-signup is intentionally not offered:
 * every employee account is provisioned by an administrator.
 */
export function BootstrapAdminPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const availability = useQuery({
    queryKey: ["admin-bootstrap-available"],
    queryFn: () => adminBootstrapAvailable(),
  });

  const form = useForm<BootstrapAdminInput>({
    resolver: zodResolver(bootstrapAdminSchema),
    defaultValues: {
      email: "",
      fullName: "",
      companyName: "",
      password: "",
      confirmPassword: "",
      redirectTo: undefined,
    },
  });

  const onSubmit = async (values: BootstrapAdminInput) => {
    try {
      await bootstrapAdminAccount({
        data: { ...values, redirectTo: `${window.location.origin}/login` },
      });
      // Email verification is mandatory, so sign-in only works after confirming.
      toast.success("Administrator account created — check your inbox to verify your email");
      navigate({ to: "/login", replace: true });
    } catch (cause) {
      form.setError("root", {
        message: cause instanceof Error ? cause.message : "Setup failed. Please try again.",
      });
    }
  };

  if (availability.isLoading) {
    return (
      <AuthLayout title="Workspace setup" description="Checking your workspace…">
        <LoadingState label="Checking workspace status…" />
      </AuthLayout>
    );
  }

  if (availability.data?.available === false) {
    return (
      <AuthLayout
        title="Setup already complete"
        description="This workspace already has an HR administrator."
      >
        <Alert>
          <AlertTitle>Nothing to do here</AlertTitle>
          <AlertDescription>
            Employee accounts are created by your HR administrator. Sign in with the Login ID you
            were issued.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-5 w-full">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </AuthLayout>
    );
  }

  const fields = [
    ["fullName", "Your full name", "text", "name"],
    ["companyName", "Company name", "text", "organization"],
    ["email", "Work email", "email", "email"],
    ["password", "Password", "password", "new-password"],
    ["confirmPassword", "Confirm password", "password", "new-password"],
  ] as const;

  return (
    <AuthLayout
      title="Create the HR administrator"
      description="This is a one-time setup step for your Dayflow workspace."
      footer={
        <>
          Already set up?{" "}
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {fields.map(([name, label, type, autoComplete]) => (
          <div key={name} className="space-y-2">
            <Label htmlFor={name}>{label}</Label>
            <Input
              id={name}
              type={type}
              autoComplete={autoComplete}
              aria-invalid={!!form.formState.errors[name]}
              {...form.register(name)}
            />
            {form.formState.errors[name] ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors[name]?.message}
              </p>
            ) : null}
          </div>
        ))}

        {form.formState.errors.root ? (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating…" : "Create administrator"}
        </Button>
      </form>
    </AuthLayout>
  );
}
