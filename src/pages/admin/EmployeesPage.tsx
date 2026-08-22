import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { LayoutGrid, List, Plus, Search, Building2, MapPin, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmployeeCard } from "@/components/employee/EmployeeCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { employeeService } from "@/services/employee/employeeService";
import type { EmployeeStatus } from "@/types";

const ALL = "ALL";

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

export function EmployeesPage() {
  const { q } = useSearch({ strict: false }) as { q?: string };
  const [query, setQuery] = useState(q ?? "");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Keep the box in step with a search launched from the top header.
  useEffect(() => {
    if (typeof q === "string") setQuery(q);
  }, [q]);

  const [department, setDepartment] = useState<string>(ALL);
  const [location, setLocation] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);

  // Search is applied server-side so filtering works across the whole directory.
  const employees = useQuery({
    queryKey: ["employees", query, department, location, status],
    queryFn: () =>
      employeeService.listEmployees({
        ...(query.trim() ? { search: query.trim() } : {}),
        ...(department !== ALL ? { department } : {}),
        ...(location !== ALL ? { location } : {}),
        ...(status !== ALL ? { status: status as EmployeeStatus } : {}),
      }),
  });

  // Full directory (unfiltered) drives the filter option lists.
  const directory = useQuery({
    queryKey: ["employees", "filter-options"],
    queryFn: () => employeeService.listEmployees(),
  });

  const { departments, locations } = useMemo(() => {
    const rows = directory.data ?? [];
    const unique = (values: (string | undefined)[]) =>
      Array.from(new Set(values.filter((value): value is string => !!value))).sort();
    return {
      departments: unique(rows.map((row) => row.department)),
      locations: unique(rows.map((row) => row.location)),
    };
  }, [directory.data]);

  const rows = employees.data ?? [];
  const hasFilters =
    query.trim() !== "" || department !== ALL || location !== ALL || status !== ALL;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employee Directory"
        description="Comprehensive directory of provisioned employees, job positions, and workplace details."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border border-border/80 bg-muted/30 p-0.5">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setViewMode("table")}
                aria-label="Table view"
              >
                <List className="size-3.5 mr-1" /> Table
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <LayoutGrid className="size-3.5 mr-1" /> Grid
              </Button>
            </div>
            <Button asChild size="sm">
              <Link to="/admin/employees/new">
                <Plus aria-hidden="true" className="mr-1 size-3.5" /> Add employee
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2.5">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-muted-foreground"
          />
          <Input
            className="h-9 pl-8 text-xs"
            placeholder="Search by name, Login ID, email, department or location…"
            aria-label="Search employees"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="h-9 w-40 text-xs" aria-label="Filter by department">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {departments.map((item) => (
              <SelectItem key={item} value={item} className="text-xs">
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="h-9 w-36 text-xs" aria-label="Filter by location">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All locations</SelectItem>
            {locations.map((item) => (
              <SelectItem key={item} value={item} className="text-xs">
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-32 text-xs" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="ACTIVE" className="text-xs">Active</SelectItem>
            <SelectItem value="INACTIVE" className="text-xs">Inactive</SelectItem>
            <SelectItem value="ON_LEAVE" className="text-xs">On leave</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={() => {
              setQuery("");
              setDepartment(ALL);
              setLocation(ALL);
              setStatus(ALL);
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {employees.isLoading ? <LoadingState label="Loading employees…" /> : null}

      {employees.isError ? (
        <ErrorState
          description="We could not load the employee directory."
          onRetry={() => void employees.refetch()}
        />
      ) : null}

      {employees.data && rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No matching employees" : "No employees yet"}
          description={
            hasFilters
              ? "Try a different search term, department or location."
              : "Create your first employee to generate their Login ID and temporary password."
          }
          action={
            hasFilters ? null : (
              <Button asChild size="sm">
                <Link to="/admin/employees/new">Add employee</Link>
              </Button>
            )
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p role="status">
              Showing <span className="font-semibold text-foreground">{rows.length}</span> employee{rows.length === 1 ? "" : "s"}
            </p>
          </div>

          {viewMode === "table" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department & Role</TableHead>
                  <TableHead>Location & Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((employee) => {
                  const name = `${employee.firstName} ${employee.lastName}`.trim();
                  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase();

                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 rounded-md border border-border/80">
                            {employee.avatarUrl ? <AvatarImage src={employee.avatarUrl} alt="" /> : null}
                            <AvatarFallback className="rounded-md bg-primary/10 text-[11px] font-bold text-primary">
                              {initials || "—"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{employee.employeeId}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">{employee.designation ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{employee.department ?? "Unassigned"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-xs text-foreground">{employee.location ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{employee.email ?? "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(employee.status)}>
                          {STATUS_LABEL[employee.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline" className="h-7 px-2.5 text-xs">
                          <Link to="/admin/employees/$employeeId" params={{ employeeId: employee.id }}>
                            View <ExternalLink className="ml-1 size-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((employee) => (
                <li key={employee.id}>
                  <EmployeeCard employee={employee} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
