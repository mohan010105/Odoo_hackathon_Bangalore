import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Ban, Check, Download, Link2, RefreshCw, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { SyncLogDetailDrawer } from "@/components/odoo/SyncLogDetailDrawer";
import {
  appendAttempt,
  lastAttempt,
  lastAttemptSummary,
  type RetryHistory,
} from "@/lib/odoo/retryHistory";


import { EmptyState, ErrorState } from "@/components/common/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ENTITY_LABELS, ODOO_ENTITIES, type OdooEntity } from "@/lib/odoo/models";
import { toCsv } from "@/lib/payroll/export";
import {
  odooIntegrationService,
  type OdooSyncLog,
  type SyncLogFilters,
} from "@/services/odoo/integrationService";

const STATUSES = ["SUCCESS", "FAILED", "SKIPPED", "NOT_AVAILABLE"] as const;
const ALL = "ALL";

type LogSearch = {
  entity?: OdooEntity;
  status?: (typeof STATUSES)[number];
  from?: string;
  to?: string;
};

/** Per-row progress of the current retry batch, shown inline in the table. */
type RetryState = "running" | "succeeded" | "failed";

/** Outcome of a single batch inside a retry run. */
type BatchReport = {
  index: number;
  total: number;
  size: number;
  succeeded: number;
  failed: number;
};

/** Totals for a completed (or cancelled) retry run. */
type RetrySummary = {
  succeeded: number;
  failed: number;
  skipped: number;
  total: number;
  cancelled: boolean;
  batchSize: number;
  batches: BatchReport[];
  finishedAt: string;
};

/** A failed entry can only be re-run when it still points at a local record. */
function isRetryable(row: OdooSyncLog) {
  return row.status === "FAILED" && Boolean(row.local_id);
}

function RetryIndicator({ state }: { state: RetryState }) {
  if (state === "running") {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        <RefreshCw aria-hidden="true" className="size-3.5 animate-spin" />
        Retrying…
      </span>
    );
  }
  if (state === "succeeded") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
        <Check aria-hidden="true" className="size-3.5" />
        Re-synced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
      <X aria-hidden="true" className="size-3.5" />
      Still failing
    </span>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading activity">
      <div className="flex gap-3">
        {["a", "b", "c", "d"].map((key) => (
          <Skeleton key={key} className="h-4 flex-1" />
        ))}
      </div>
      {["r1", "r2", "r3", "r4", "r5"].map((key) => (
        <div key={key} className="flex items-center gap-3">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * Synchronisation activity log for the admin integration dashboard. Filters
 * live in the URL so a filtered view can be refreshed or shared, and failed
 * entries can be re-run individually or in a selected batch after explicit
 * confirmation. Only summarised, safe messages are shown — never credentials
 * or provider internals.
 */
export function SyncActivityLog({ anchorId = "sync-activity" }: { anchorId?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Filters are read from (and written to) the URL so the exact view is shareable.
  const search = useSearch({ strict: false }) as LogSearch;

  const entity = search.entity ?? ALL;
  const status = search.status ?? ALL;
  const from = search.from ?? "";
  const to = search.to ?? "";

  const [selected, setSelected] = useState<Set<string>>(() => new Set<string>());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTargets, setPendingTargets] = useState<OdooSyncLog[]>([]);
  const [retryStates, setRetryStates] = useState<Record<string, RetryState>>({});
  const [history, setHistory] = useState<RetryHistory>({});
  const [detailRow, setDetailRow] = useState<OdooSyncLog | null>(null);
  // How many records are re-sent to Odoo at once during a batch retry.
  const [concurrency, setConcurrency] = useState(1);
  // Set when the admin presses Cancel; checked between batches so the run stops
  // as soon as the batch in flight settles (no request is abandoned mid-write).
  const cancelRef = useRef(false);
  const [cancelling, setCancelling] = useState(false);
  const [summary, setSummary] = useState<RetrySummary | null>(null);




  const hasFilters = Boolean(search.entity || search.status || search.from || search.to);

  const setFilter = (patch: LogSearch) => {
    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => {
        const next = { ...previous, ...patch };
        for (const key of ["entity", "status", "from", "to"] as const) {
          if (!next[key]) delete next[key];
        }
        return next;
      },
      replace: true,
    });
  };

  const resetFilters = () => {
    setSelected(new Set());
    void navigate({ to: ".", search: {}, replace: true });
  };

  const copyFilteredLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Filtered link copied to your clipboard.");
    } catch {
      toast.error("We could not copy the link. Copy it from the address bar instead.");
    }
  };

  const filters: SyncLogFilters = {
    ...(entity === ALL ? {} : { entity }),
    ...(status === ALL ? {} : { status }),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    limit: 100,
  };

  const logs = useQuery({
    queryKey: ["odoo-sync-logs", entity, status, from, to],
    queryFn: () => odooIntegrationService.logs(filters),
  });

  const rows = logs.data ?? [];
  const retryableRows = rows.filter(isRetryable);
  const selectedRows = retryableRows.filter((row) => selected.has(row.id));

  const retrySelected = useMutation({
    mutationFn: async (targets: OdooSyncLog[]): Promise<RetrySummary> => {
      let succeeded = 0;
      let failed = 0;
      const batchReports: BatchReport[] = [];
      // Retries run in bounded batches: the mapping makes each retry idempotent,
      // so a record is updated rather than duplicated, and the batch size keeps
      // pressure off Odoo while giving clearer progress feedback.
      const size = Math.max(1, concurrency);
      const batches: OdooSyncLog[][] = [];
      for (let index = 0; index < targets.length; index += size) {
        batches.push(targets.slice(index, index + size));
      }

      const runOne = async (row: OdooSyncLog) => {
        setRetryStates((current) => ({ ...current, [row.id]: "running" }));
        const label = row.record_label ?? ENTITY_LABELS[row.entity_type];
        try {
          const result = (await odooIntegrationService.retryRecord(
            row.entity_type,
            row.local_id ?? "",
          )) as {
            ok: boolean;
            odooId?: number | null;
            errorCode?: string | null;
            attemptedAt?: string;
            message?: string;
          };
          const attemptedAt = result.attemptedAt ?? new Date().toISOString();
          if (result.ok) {
            succeeded += 1;
            setRetryStates((current) => ({ ...current, [row.id]: "succeeded" }));
            setHistory((current) =>
              appendAttempt(current, row.id, {
                attemptedAt,
                outcome: "SUCCESS",
                odooId: result.odooId ?? row.odoo_id ?? null,
                errorCode: null,
                message: result.message ?? "Record synchronised with Odoo.",
              }),
            );
          } else {
            failed += 1;
            setRetryStates((current) => ({ ...current, [row.id]: "failed" }));
            setHistory((current) =>
              appendAttempt(current, row.id, {
                attemptedAt,
                outcome: "FAILED",
                odooId: result.odooId ?? null,
                errorCode: result.errorCode ?? row.error_code ?? null,
                message: result.message ?? "The retry did not succeed.",
              }),
            );
          }
        } catch {
          failed += 1;
          setRetryStates((current) => ({ ...current, [row.id]: "failed" }));
          setHistory((current) =>
            appendAttempt(current, row.id, {
              attemptedAt: new Date().toISOString(),
              outcome: "FAILED",
              odooId: null,
              errorCode: row.error_code ?? null,
              message: "The retry could not be completed.",
            }),
          );
        }
        return label;
      };

      let processed = 0;
      let cancelled = false;
      for (const [index, batch] of batches.entries()) {
        if (cancelRef.current) {
          cancelled = true;
          break;
        }
        const toastId = `odoo-retry-batch-${index}`;
        toast.loading(
          `Batch ${index + 1} of ${batches.length}: retrying ${batch.length} record${
            batch.length === 1 ? "" : "s"
          }…`,
          { id: toastId },
        );
        const before = { succeeded, failed };
        await Promise.all(batch.map((row) => runOne(row)));
        processed += batch.length;
        const batchOk = succeeded - before.succeeded;
        const batchFailed = failed - before.failed;
        batchReports.push({
          index: index + 1,
          total: batches.length,
          size: batch.length,
          succeeded: batchOk,
          failed: batchFailed,
        });
        if (batchFailed === 0) {
          toast.success(`Batch ${index + 1} of ${batches.length}: ${batchOk} re-synchronised.`, {
            id: toastId,
          });
        } else if (batchOk === 0) {
          toast.error(`Batch ${index + 1} of ${batches.length}: ${batchFailed} still failing.`, {
            id: toastId,
          });
        } else {
          toast.warning(
            `Batch ${index + 1} of ${batches.length}: ${batchOk} succeeded, ${batchFailed} still failing.`,
            { id: toastId },
          );
        }
      }
      return {
        succeeded,
        failed,
        skipped: targets.length - processed,
        total: targets.length,
        cancelled,
        batchSize: size,
        batches: batchReports,
        finishedAt: new Date().toISOString(),
      };
    },
    onSuccess: (result) => {
      const { succeeded, failed, skipped, cancelled } = result;
      setSummary(result);
      if (cancelled)
        toast.warning(`Retry run cancelled: ${succeeded} succeeded, ${skipped} not attempted.`);
      else if (failed === 0) toast.success(`Re-ran ${succeeded} failed record(s) successfully.`);
      else if (succeeded === 0) toast.error(`${failed} record(s) still could not be synchronised.`);
      else toast.warning(`${succeeded} succeeded, ${failed} still failing.`);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["odoo-sync-logs"] });
      void queryClient.invalidateQueries({ queryKey: ["odoo-sync-errors"] });
      void queryClient.invalidateQueries({ queryKey: ["odoo-overview"] });
    },
    onError: () => toast.error("The retry could not be completed."),
    onSettled: () => {
      cancelRef.current = false;
      setCancelling(false);
    },
  });



  const requestRetry = (targets: OdooSyncLog[]) => {
    setPendingTargets(targets);
    setConfirmOpen(true);
  };

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.info("There is no activity to export for these filters.");
      return;
    }
    const csv = toCsv(
      [
        "Timestamp",
        "Module",
        "Direction",
        "Record",
        "Odoo ID",
        "Status",
        "Detail",
        "Failure reason",
        "Last retry result",
        "Retry attempts",
        "Duration (ms)",
      ],
      rows.map((row) => [
        new Date(row.created_at).toISOString(),
        ENTITY_LABELS[row.entity_type],
        row.direction,
        row.record_label ?? "",
        row.odoo_id ?? "",
        row.status,
        row.message ?? "",
        row.status === "FAILED" ? (row.error_code ?? row.message ?? "Unknown failure") : "",
        lastAttemptSummary(lastAttempt(history, row.id)),
        (history[row.id] ?? []).length,
        row.duration_ms ?? "",
      ]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `odoo-sync-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} log entr${rows.length === 1 ? "y" : "ies"}.`);
  };


  const allSelected = retryableRows.length > 0 && selectedRows.length === retryableRows.length;
  const onlyFailedView = status === "FAILED";

  return (
    <Card id={anchorId} className="scroll-mt-24">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Synchronisation activity</CardTitle>
          <CardDescription>
            Filter by module, status and date — the current view is kept in the address bar.
            Messages are summarised: credentials and provider internals are never shown.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedRows.length > 0 ? (
            <Button onClick={() => requestRetry(selectedRows)} disabled={retrySelected.isPending}>
              <RefreshCw
                className={`mr-2 size-4 ${retrySelected.isPending ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {retrySelected.isPending ? "Retrying…" : `Retry selected (${selectedRows.length})`}
            </Button>
          ) : null}
          {retryableRows.length > 0 ? (
            <Button
              variant="secondary"
              onClick={() => requestRetry(retryableRows)}
              disabled={retrySelected.isPending}
            >
              <RefreshCw
                className={`mr-2 size-4 ${retrySelected.isPending ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Retry all failed ({retryableRows.length})
            </Button>
          ) : null}
          {retrySelected.isPending ? (
            <Button
              variant="outline"
              onClick={() => {
                cancelRef.current = true;
                setCancelling(true);
                toast.info("Cancelling — the batch in progress will finish, then the run stops.");
              }}
              disabled={cancelling}
            >
              <Ban className="mr-2 size-4" aria-hidden="true" />
              {cancelling ? "Cancelling…" : "Cancel run"}
            </Button>
          ) : null}
          {retryableRows.length > 0 ? (
            <div className="flex items-center gap-2">
              <Label htmlFor="retry-concurrency" className="text-xs whitespace-nowrap">
                Batch size
              </Label>
              <Select
                value={String(concurrency)}
                onValueChange={(value) => setConcurrency(Number(value))}
              >
                <SelectTrigger id="retry-concurrency" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value} at a time
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}



          <Button variant="outline" onClick={() => void copyFilteredLink()}>
            <Link2 className="mr-2 size-4" aria-hidden="true" />
            Copy filtered link
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={logs.isPending}>
            <Download className="mr-2 size-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="sync-log-entity">Module</Label>
            <Select
              value={entity}
              onValueChange={(value) =>
                setFilter({ ...(value === ALL ? {} : { entity: value as OdooEntity }) })
              }
            >
              <SelectTrigger id="sync-log-entity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All modules</SelectItem>
                {ODOO_ENTITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ENTITY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sync-log-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                setFilter({
                  ...(value === ALL ? {} : { status: value as (typeof STATUSES)[number] }),
                })
              }
            >
              <SelectTrigger id="sync-log-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "NOT_AVAILABLE" ? "Not available" : value.toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sync-log-from">From</Label>
            <Input
              id="sync-log-from"
              type="date"
              value={from}
              onChange={(event) => setFilter({ from: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sync-log-to">To</Label>
            <Input
              id="sync-log-to"
              type="date"
              value={to}
              onChange={(event) => setFilter({ to: event.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="ghost"
              className="w-full"
              disabled={!hasFilters}
              onClick={resetFilters}
            >
              <RotateCcw className="mr-2 size-4" aria-hidden="true" />
              Reset filters
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {logs.isPending ? (
            <ActivitySkeleton />
          ) : logs.isError ? (
            <ErrorState
              title="Activity unavailable"
              description="We could not read the synchronisation history."
              onRetry={() => void logs.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={onlyFailedView ? "No failed entries" : "No matching activity"}
              description={
                onlyFailedView
                  ? "Every synchronisation attempt in this range succeeded — there is nothing to retry."
                  : "Nothing matches these filters yet. Reset them or run a sync to see activity here."
              }
              action={
                hasFilters ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <RotateCcw className="mr-2 size-3.5" aria-hidden="true" />
                    Reset filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      disabled={retryableRows.length === 0}
                      aria-label="Select all failed entries"
                      onCheckedChange={(checked) =>
                        setSelected(
                          checked === true ? new Set(retryableRows.map((row) => row.id)) : new Set(),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const retryable = isRetryable(row);
                  const retryState = retryStates[row.id];
                  return (
                    <TableRow
                      key={row.id}
                      data-state={selected.has(row.id) ? "selected" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(row.id)}
                          disabled={!retryable}
                          aria-label={`Select ${row.record_label ?? "entry"} for retry`}
                          onCheckedChange={(checked) =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (checked === true) next.add(row.id);
                              else next.delete(row.id);
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{ENTITY_LABELS[row.entity_type]}</TableCell>
                      <TableCell className="max-w-52 truncate">{row.record_label ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant={
                              row.status === "SUCCESS"
                                ? "default"
                                : row.status === "FAILED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {row.status}
                          </Badge>
                          {retryState ? <RetryIndicator state={retryState} /> : null}
                          {(history[row.id] ?? []).length > 0 ? (
                            <span className="text-[11px] text-muted-foreground">
                              {(history[row.id] ?? []).length} retry attempt
                              {(history[row.id] ?? []).length === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.message ?? "—"}
                      </TableCell>
                      <TableCell className="space-x-1 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => setDetailRow(row)}>
                          Details
                        </Button>
                        {retryable ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={retrySelected.isPending}
                            onClick={() => requestRetry([row])}
                          >
                            Retry
                          </Button>
                        ) : null}
                      </TableCell>

                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Re-run {pendingTargets.length} failed record
              {pendingTargets.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Records are re-sent to Odoo in batches of {concurrency}, with a progress update per
              batch. Retries are matched against the existing link, so records are updated rather
              than duplicated.

            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const targets = pendingTargets;
                setRetryStates((current) => {
                  const next = { ...current };
                  for (const row of targets) delete next[row.id];
                  return next;
                });
                retrySelected.mutate(targets);
              }}
            >
              Retry now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={summary !== null} onOpenChange={(open) => (open ? null : setSummary(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {summary?.cancelled ? "Retry run cancelled" : "Retry run complete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {summary
                ? `${summary.total} record${summary.total === 1 ? "" : "s"} queued in batches of ${summary.batchSize}.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {summary ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-border p-3">
                  <dt className="text-xs text-muted-foreground">Succeeded</dt>
                  <dd className="text-lg font-semibold text-primary">{summary.succeeded}</dd>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <dt className="text-xs text-muted-foreground">Failed</dt>
                  <dd className="text-lg font-semibold text-destructive">{summary.failed}</dd>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <dt className="text-xs text-muted-foreground">Skipped</dt>
                  <dd className="text-lg font-semibold">{summary.skipped}</dd>
                </div>
              </dl>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Succeeded</TableHead>
                      <TableHead>Failed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.batches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-sm text-muted-foreground">
                          No batches ran before the run was cancelled.
                        </TableCell>
                      </TableRow>
                    ) : (
                      summary.batches.map((batch) => (
                        <TableRow key={batch.index}>
                          <TableCell>
                            {batch.index} of {batch.total}
                          </TableCell>
                          <TableCell>{batch.size}</TableCell>
                          <TableCell>{batch.succeeded}</TableCell>
                          <TableCell>{batch.failed}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSummary(null)}>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SyncLogDetailDrawer
        row={detailRow}
        attempts={detailRow ? (history[detailRow.id] ?? []) : []}
        retrying={retrySelected.isPending}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
        onRetry={(row) => requestRetry([row])}
      />
    </Card>

  );
}
