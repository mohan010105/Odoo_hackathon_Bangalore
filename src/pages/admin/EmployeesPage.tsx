import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmployeeCard } from "@/components/employee/EmployeeCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { employeeService } from "@/services/employee/employeeService";
import type { EmployeeStatus } from "@/types";

const ALL = "ALL";

export function EmployeesPage() {
  const { q } = useSearch({ strict: false }) as { q?: string };
  const [query, setQuery] = useState(q ?? "");

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
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Directory of every provisioned employee account."
        actions={
          <Button asChild>
            <Link to="/admin/employees/new">
              <Plus aria-hidden="true" className="size-4" /> Add employee
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
          />
          <Input
            className="pl-9"
            placeholder="Search by name, email, Login ID, department or location"
            aria-label="Search employees"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-44" aria-label="Filter by department">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {departments.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="w-44" aria-label="Filter by location">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All locations</SelectItem>
            {locations.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="ON_LEAVE">On leave</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button
            variant="ghost"
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
              ? "Try a different name, email, department or location."
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
        <>
          <p className="text-sm text-muted-foreground" role="status">
            Showing {rows.length} employee{rows.length === 1 ? "" : "s"}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((employee) => (
              <li key={employee.id}>
                <EmployeeCard employee={employee} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
