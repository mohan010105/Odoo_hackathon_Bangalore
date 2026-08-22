import { Link } from "@tanstack/react-router";
import { Building2, MapPin, Mail, ChevronRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { EmployeeWithMeta } from "@/services/employee/employeeService";
import type { EmployeeStatus } from "@/types";

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ON_LEAVE: "On leave",
};

function statusVariant(status: EmployeeStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "ON_LEAVE") return "warning" as const;
  return "neutral" as const;
}

export function EmployeeCard({ employee }: { employee: EmployeeWithMeta }) {
  const name = `${employee.firstName} ${employee.lastName}`.trim();
  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase();

  return (
    <Link
      to="/admin/employees/$employeeId"
      params={{ employeeId: employee.id }}
      className="card-interactive group flex flex-col justify-between rounded-lg border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label={`Open ${name}`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="size-10 rounded-md border border-border/80">
              {employee.avatarUrl ? <AvatarImage src={employee.avatarUrl} alt="" /> : null}
              <AvatarFallback className="rounded-md bg-primary/10 text-xs font-bold text-primary">
                {initials || "—"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {name}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">{employee.employeeId}</p>
            </div>
          </div>
          <Badge variant={statusVariant(employee.status)} className="shrink-0 text-[11px]">
            {STATUS_LABEL[employee.status]}
          </Badge>
        </div>

        <div className="space-y-1.5 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 truncate">
            <Building2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/80" />
            <span className="truncate">
              {employee.designation ?? "Position not set"}
              {employee.department ? ` · ${employee.department}` : ""}
            </span>
          </div>
          {employee.location ? (
            <div className="flex items-center gap-2 truncate">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/80" />
              <span className="truncate">{employee.location}</span>
            </div>
          ) : null}
          {employee.email ? (
            <div className="flex items-center gap-2 truncate">
              <Mail aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/80" />
              <span className="truncate">{employee.email}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs font-medium text-primary">
        <span>View record</span>
        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
