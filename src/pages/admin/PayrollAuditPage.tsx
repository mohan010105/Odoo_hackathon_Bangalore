import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { AUDIT_ACTION_LABELS, auditService } from "@/services/audit/auditService";

const ALL = "ALL";

const PAYROLL_EVENTS = [
  { value: "payroll.previewed", label: "Previewed" },
  { value: "payroll.generated", label: "Generated / confirmed" },
  { value: "payroll.status_changed", label: "Marked processed or paid" },
  { value: "payroll.exported", label: "Exported to CSV" },
  { value: "payroll.payslips_downloaded", label: "Payslips downloaded" },
  { value: "salary.structure_changed", label: "Salary structure changed" },
  { value: "salary.component_changed", label: "Salary component changed" },
] as const;

/**
 * Payroll activity trail: who previewed, generated, exported and finalised each
 * payroll period. Reads the admin-only activity log, which the database also
 * restricts to administrators.
 */
export function PayrollAuditPage() {
  const [action, setAction] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const logs = useQuery({
    queryKey: ["payroll-audit", action, search],
    queryFn: () =>
      auditService.list({
        ...(action !== ALL ? { action } : { actionPrefix: "payroll." }),
        ...(search.trim() ? { search: search.trim() } : {}),
      }),
  });

  const rows = logs.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll activity"
        description="Every payroll preview, generation, export and status change, with the administrator who performed it."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/payroll">Back to payroll</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/audit">Full activity log</Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader className="gap-4">
          <CardTitle>Payroll audit trail</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="payroll-audit-search">Search</Label>
              <Input
                id="payroll-audit-search"
                className="w-[260px]"
                placeholder="Administrator email or period"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payroll-audit-action">Event</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger id="payroll-audit-action" className="w-[240px]">
                  <SelectValue placeholder="All payroll events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All payroll events</SelectItem>
                  {PAYROLL_EVENTS.map((event) => (
                    <SelectItem key={event.value} value={event.value}>
                      {event.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.isPending ? (
            <LoadingState label="Loading payroll activity…" />
          ) : logs.isError ? (
            <ErrorState
              title="Activity log unavailable"
              description={logs.error instanceof Error ? logs.error.message : "Please try again."}
              onRetry={() => void logs.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No payroll activity yet"
              description="Payroll previews, generation runs, exports and status changes appear here as they happen."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Administrator</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {AUDIT_ACTION_LABELS[row.action] ?? row.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{row.actorEmail ?? "System"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {row.entityType === "payroll_period" ? (row.entityId ?? "—") : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.summary ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
