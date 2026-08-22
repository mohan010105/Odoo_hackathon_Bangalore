import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { previewLoginId } from "@/lib/employee/loginId";
import { createEmployeeSchema, type CreateEmployeeInput } from "@/lib/validation/employee";
import { companyService } from "@/services/company/companyService";
import { orgService } from "@/services/org/orgService";
import { employeeService } from "@/services/employee/employeeService";

const NONE = "__none__";

type IssuedCredentials = {
  name: string;
  loginId: string;
  temporaryPassword: string;
};

function CredentialRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm text-foreground">{value}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <Copy aria-hidden="true" className="size-4" />
        )}
        <span className="sr-only sm:not-sr-only">{copied ? "Copied" : `Copy ${label}`}</span>
      </Button>
    </div>
  );
}

export function CreateEmployeePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);
  const [picture, setPicture] = useState<File | null>(null);

  const form = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      joiningDate: new Date().toISOString().slice(0, 10),
      department: "",
      jobPosition: "",
      manager: "",
      location: "",
    } as unknown as CreateEmployeeInput,
  });

  const departments = useQuery({
    queryKey: ["departments", "active"],
    queryFn: () => orgService.listDepartments(false),
  });
  const positions = useQuery({
    queryKey: ["job-positions", "active"],
    queryFn: () => orgService.listPositions({ includeInactive: false }),
  });

  const watched = form.watch();
  const idPreview = previewLoginId(
    watched.firstName ?? "",
    watched.lastName ?? "",
    watched.joiningDate ?? "",
  );

  const onSubmit = async (values: CreateEmployeeInput) => {
    try {
      let profilePicturePath: string | undefined;
      if (picture) {
        profilePicturePath = await companyService.uploadProfilePicture(picture);
      }

      const result = await employeeService.createEmployee({
        ...values,
        ...(profilePicturePath ? { profilePicturePath } : {}),
        verificationRedirectTo: `${window.location.origin}/login`,
      });

      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      setIssued({
        name: `${values.firstName} ${values.lastName}`.trim(),
        loginId: result.loginId,
        temporaryPassword: result.temporaryPassword,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "We could not create this employee.";
      form.setError("root", { message });
      toast.error("Employee not created", { description: message });
    }
  };

  const textFields = [
    ["firstName", "First name", "text"],
    ["lastName", "Last name", "text"],
    ["email", "Work email", "email"],
    ["phone", "Phone (optional)", "tel"],
    ["joiningDate", "Joining date", "date"],
    ["manager", "Manager (optional)", "text"],
    ["location", "Location (optional)", "text"],
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add employee"
        description="Dayflow generates the Login ID and a temporary password automatically."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/employees">Back to directory</Link>
          </Button>
        }
      />

      <Alert>
        <AlertTitle>How credentials work</AlertTitle>
        <AlertDescription>
          The Login ID follows the format <span className="font-mono">{idPreview}</span> and the
          serial is assigned by the system. The temporary password is shown once after creation —
          the employee must change it at first sign-in.
        </AlertDescription>
      </Alert>

      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-5 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
      >
        {textFields.map(([name, label, type]) => (
          <div key={name} className="space-y-2">
            <Label htmlFor={name}>{label}</Label>
            <Input
              id={name}
              type={type}
              aria-invalid={!!form.formState.errors[name]}
              {...form.register(name)}
            />
            {form.formState.errors[name] ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors[name]?.message as string}
              </p>
            ) : null}
          </div>
        ))}

        <div className="space-y-2">
          <Label htmlFor="department">Department (optional)</Label>
          <Select
            value={watched.department || NONE}
            onValueChange={(value) =>
              form.setValue("department", value === NONE ? "" : value, { shouldDirty: true })
            }
          >
            <SelectTrigger id="department">
              <SelectValue placeholder="No department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No department</SelectItem>
              {(departments.data ?? []).map((department) => (
                <SelectItem key={department.id} value={department.name}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Manage the list under People → Departments.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jobPosition">Job position (optional)</Label>
          <Select
            value={watched.jobPosition || NONE}
            onValueChange={(value) =>
              form.setValue("jobPosition", value === NONE ? "" : value, { shouldDirty: true })
            }
          >
            <SelectTrigger id="jobPosition">
              <SelectValue placeholder="No position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No position</SelectItem>
              {(positions.data ?? []).map((position) => (
                <SelectItem key={position.id} value={position.title}>
                  {position.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Manage the list under People → Job positions.
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="picture">Profile picture (optional)</Label>
          <Input
            id="picture"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setPicture(event.target.files?.[0] ?? null)}
          />
        </div>

        {form.formState.errors.root ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creating employee…" : "Create employee"}
          </Button>
        </div>
      </form>

      <Dialog
        open={!!issued}
        onOpenChange={(open) => {
          if (!open) {
            setIssued(null);
            navigate({ to: "/admin/employees" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credentials for {issued?.name}</DialogTitle>
            <DialogDescription>
              Share these securely with the employee. The temporary password cannot be shown again —
              you would need to reset it instead. The employee must confirm the verification email
              we just sent before their first sign-in.
            </DialogDescription>
          </DialogHeader>

          {issued ? (
            <div className="space-y-2">
              <CredentialRow label="Login ID" value={issued.loginId} />
              <CredentialRow label="Temporary password" value={issued.temporaryPassword} />
            </div>
          ) : null}

          <DialogFooter>
            <Button
              onClick={() => {
                setIssued(null);
                navigate({ to: "/admin/employees" });
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
