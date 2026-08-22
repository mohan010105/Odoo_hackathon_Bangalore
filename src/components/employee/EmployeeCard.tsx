import { Link } from "@tanstack/react-router";
import { Building2, MapPin } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { EmployeeWithMeta } from "@/services/employee/employeeService";
import type { EmployeeStatus } from "@/types";

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Not active",
  ON_LEAVE: "On leave",
};

function statusVariant(status: EmployeeStatus) {
  if (status === "ACTIVE") return "default" as const;
  if (status === "ON_LEAVE") return "secondary" as const;
  return "outline" as const;
}

export function EmployeeCard({ employee }: { employee: EmployeeWithMeta }) {
  const name = `${employee.firstName} ${employee.lastName}`.trim();
  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase();

  return (
    <Link
      to="/admin/employees/$employeeId"
      params={{ employeeId: employee.id }}
      className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label={`Open ${name}`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-11">
          {employee.avatarUrl ? <AvatarImage src={employee.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials || "—"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-semibold text-foreground">{name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{employee.employeeId}</p>
        </div>
        <Badge variant={statusVariant(employee.status)}>{STATUS_LABEL[employee.status]}</Badge>
      </div>

      <dl className="space-y-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Building2 aria-hidden="true" className="size-3.5" />
          <dt className="sr-only">Job position</dt>
          <dd className="truncate">
            {employee.designation ?? "Position not set"}
            {employee.department ? ` · ${employee.department}` : ""}
          </dd>
        </div>
        {employee.location ? (
          <div className="flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-3.5" />
            <dt className="sr-only">Location</dt>
            <dd className="truncate">{employee.location}</dd>
          </div>
        ) : null}
      </dl>
    </Link>
  );
}
