import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingState } from "@/components/common/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { employeeService } from "@/services/employee/employeeService";

export function EmployeeDetailPage({ employeeId }: { employeeId: string }) {
  const employee = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => employeeService.getEmployee(employeeId),
  });

  if (employee.isLoading) return <LoadingState label="Loading employee…" />;

  if (employee.isError || !employee.data) {
    return (
      <ErrorState
        title="Employee unavailable"
        description="We could not load this employee record."
        onRetry={() => void employee.refetch()}
      />
    );
  }

  const record = employee.data;
  const name = `${record.firstName} ${record.lastName}`.trim();

  const details: Array<[string, string]> = [
    ["Login ID", record.employeeId],
    ["Work email", record.email],
    ["Phone", record.phone ?? "—"],
    ["Department", record.department ?? "—"],
    ["Job position", record.designation ?? "—"],
    ["Manager", record.manager ?? "—"],
    ["Location", record.location ?? "—"],
    ["Joining date", record.joiningDate ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description="Employee record and generated login identity."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/employees">Back to directory</Link>
          </Button>
        }
      />

      <section className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
        <Avatar className="size-16">
          {record.avatarUrl ? <AvatarImage src={record.avatarUrl} alt="" /> : null}
          <AvatarFallback>
            {`${record.firstName[0] ?? ""}${record.lastName[0] ?? ""}`.toUpperCase() || "—"}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-display text-lg font-semibold text-foreground">{name}</p>
          <p className="font-mono text-sm text-muted-foreground">{record.employeeId}</p>
        </div>
        <Badge className="ml-auto" variant={record.status === "ACTIVE" ? "default" : "outline"}>
          {record.status.replace("_", " ").toLowerCase()}
        </Badge>
      </section>

      <dl className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="mt-1 text-sm text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
