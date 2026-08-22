import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Download, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useIdempotentExport } from "@/lib/exports/idempotency";
import { toCsv } from "@/lib/payroll/export";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  SENSITIVE_AUDIT_ACTIONS,
  auditService,
  type AuditSortField,
} from "@/services/audit/auditService";

const ALL = "ALL";
const SENSITIVE_SET = new Set<string>(SENSITIVE_AUDIT_ACTIONS);
const PAGE_SIZE = 25;

/** Columns the log can be sorted by, mapped to their database field. */
const SORTABLE: { field: AuditSortField; label: string }[] = [
  { field: "created_at", label: "When" },
  { field: "action", label: "Event" },
  { field: "actor_email", label: "Actor" },
  { field: "entity_id", label: "Record" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Outcome keywords as they appear in the human-readable summaries. */
const OUTCOMES = [
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "generated", label: "Generated" },
  { id: "processed", label: "Processed" },
  { id: "paid", label: "Paid" },
  { id: "failed", label: "Failed" },
];

function label(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

function timestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Admin-only audit trail. Sensitive actions (approvals, rejections, leave
 * allocations, password changes, attendance corrections, payroll and Odoo
 * syncs) can be isolated with one toggle, and the log can be narrowed by
 * employee or actor, payroll period, action type, outcome and date range.
 * Credentials are never recorded.
 */
export function AuditLogsPage() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const [search, setSearch] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [action, setAction] = useState<string>(ALL);
  const [outcome, setOutcome] = useState<string>(ALL);
  const [year, setYear] = useState<string>(ALL);
  const [month, setMonth] = useState<string>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sensitiveOnly, setSensitiveOnly] = useState(true);
  const [sortBy, setSortBy] = useState<AuditSortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const exports = useIdempotentExport<"audit-csv">();

  // A payroll period is stored on the entry as entity_id, e.g. 2026-03.
  const period =
    year !== ALL && month !== ALL ? `${year}-${String(Number(month)).padStart(2, "0")}` : "";

  const filters = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(actorEmail.trim() ? { actorEmail: actorEmail.trim() } : {}),
    ...(action !== ALL ? { action } : {}),
    ...(outcome !== ALL ? { summaryContains: outcome } : {}),
    ...(period ? { entityType: "payroll_period", entityId: period } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };

  // The sensitive-only view is applied on the server so totals and paging stay
  // accurate rather than filtering a page after it has been fetched.
  const scopedFilters = {
    ...filters,
    ...(sensitiveOnly && action === ALL ? { actions: SENSITIVE_AUDIT_ACTIONS } : {}),
  };

  const logs = useQuery({
    queryKey: ["audit-logs", scopedFilters, sortBy, sortDir, page],
    queryFn: () =>
      auditService.list({ ...scopedFilters, sortBy, sortDir, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  });

  const rows = logs.data?.rows ?? [];
  const total = logs.data?.total ?? 0;
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0);

  // Any filter or sort change starts the list again from the first page.
  const filterKey = JSON.stringify([scopedFilters, sortBy, sortDir]);
  useEffect(() => {
    setPage(0);
  }, [filterKey]);

  const toggleSort = (field: AuditSortField) => {
    if (field === sortBy) setSortDir((value) => (value === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir(field === "created_at" ? "desc" : "asc");
    }
  };

  const exportCsv = () =>
    void exports.run("audit-csv", async (idempotencyKey) => {
      try {
        const entries = await auditService.listForExport({ ...scopedFilters, sortBy, sortDir });
        if (entries.length === 0) {
          toast.info("There is nothing to export for these filters.");
          return;
        }

        const csv = toCsv(
          ["Timestamp", "Event", "Action", "Actor", "Record type", "Record", "Details"],
          entries.map((entry) => [
            new Date(entry.createdAt).toISOString(),
            label(entry.action),
            entry.action,
            entry.actorEmail ?? "System",
            entry.entityType ?? "",
            entry.entityId ?? "",
            entry.summary ?? "",
          ]),
        );

        const result = await auditService.logExport({
          idempotencyKey,
          recordCount: entries.length,
          scope: sensitiveOnly && action === ALL ? "sensitive" : "filtered",
        });

        // A duplicate claim means this export was already recorded and
        // downloaded; skip the second file rather than repeating it.
        if (result.duplicate) {
          toast.info("That export has already been generated.");
          return;
        }

        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `dayflow-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`);
      } catch {
        toast.error("We could not export the activity log.");
      }
    });

  const reset = () => {
    setSearch("");
    setActorEmail("");
    setAction(ALL);
    setOutcome(ALL);
    setYear(ALL);
    setMonth(ALL);
    setFrom("");
    setTo("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="Who did what, and when. Passwords, tokens and Odoo credentials are never recorded."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={exports.busy || logs.isLoading}>
              <Download aria-hidden="true" className="mr-2 size-4" />
              {exports.busy ? "Exporting…" : "Export CSV"}
            </Button>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw aria-hidden="true" className="mr-2 size-4" />
              Reset filters
            </Button>
            <Button
              variant={sensitiveOnly ? "default" : "outline"}
              onClick={() => setSensitiveOnly((value) => !value)}
              aria-pressed={sensitiveOnly}
            >
              <ShieldAlert aria-hidden="true" className="mr-2 size-4" />
              {sensitiveOnly ? "Sensitive actions" : "All actions"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="audit-search">Search</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
            />
            <Input
              id="audit-search"
              className="pl-9"
              placeholder="Employee name, login ID or details"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-actor">Actor email</Label>
          <Input
            id="audit-actor"
            type="email"
            placeholder="hr@company.com"
            value={actorEmail}
            onChange={(event) => setActorEmail(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Action type</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger id="audit-action">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All events</SelectItem>
              {AUDIT_ACTIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {label(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-year">Payroll year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger id="audit-year">
              <SelectValue placeholder="Any year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any year</SelectItem>
              {years.map((item) => (
                <SelectItem key={item} value={String(item)}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-month">Payroll month</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger id="audit-month">
              <SelectValue placeholder="Any month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any month</SelectItem>
              {MONTHS.map((name, index) => (
                <SelectItem key={name} value={String(index + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-outcome">Outcome</Label>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger id="audit-outcome">
              <SelectValue placeholder="Any outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any outcome</SelectItem>
              {OUTCOMES.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-from">From</Label>
          <Input
            id="audit-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-to">To</Label>
          <Input
            id="audit-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>

      {year !== ALL && month === ALL ? (
        <p className="text-sm text-muted-foreground">
          Pick a month as well to filter by a specific payroll period.
        </p>
      ) : null}

      {logs.isLoading ? <LoadingState label="Loading activity…" /> : null}

      {logs.isError ? (
        <ErrorState
          description="We could not load the activity log."
          onRetry={() => void logs.refetch()}
        />
      ) : null}

      {logs.data && total === 0 ? (
        <EmptyState
          title="No matching activity"
          description={
            sensitiveOnly
              ? "No sensitive actions have been recorded for these filters yet."
              : "Events appear here as employees are provisioned and accounts are used."
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                {SORTABLE.map((column) => (
                  <TableHead
                    key={column.field}
                    scope="col"
                    aria-sort={
                      sortBy === column.field
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      onClick={() => toggleSort(column.field)}
                    >
                      {column.label}
                      {sortBy === column.field ? (
                        sortDir === "asc" ? (
                          <ArrowUp aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ArrowDown aria-hidden="true" className="size-3.5" />
                        )
                      ) : null}
                    </button>
                  </TableHead>
                ))}
                <TableHead scope="col">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {timestamp(entry.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={SENSITIVE_SET.has(entry.action) ? "default" : "secondary"}>
                      {label(entry.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {entry.actorEmail ?? "System"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {entry.entityType ? `${entry.entityType}${entry.entityId ? ` · ${entry.entityId}` : ""}` : "—"}
                  </TableCell>
                  <TableCell>{entry.summary ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => Math.max(value - 1, 0))}
              disabled={page === 0 || logs.isFetching}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => Math.min(value + 1, lastPage))}
              disabled={page >= lastPage || logs.isFetching}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
