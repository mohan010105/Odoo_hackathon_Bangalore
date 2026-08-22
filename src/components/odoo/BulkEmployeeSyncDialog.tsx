import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  odooIntegrationService,
  type EmployeeSyncOutcome,
  type EmployeeSyncPreview,
} from "@/services/odoo/integrationService";

/** Chunk size the browser sends per request; the server also bounds concurrency. */
const CHUNK_SIZE = 5;

type Mode = "DRY_RUN" | "APPLY";

type RunState = {
  mode: Mode;
  processed: number;
  total: number;
  created: number;
  updated: number;
  failed: number;
  failures: { name: string; message: string }[];
  done: boolean;
  cancelled: boolean;
};

const EMPTY_RUN: RunState = {
  mode: "APPLY",
  processed: 0,
  total: 0,
  created: 0,
  updated: 0,
  failed: 0,
  failures: [],
  done: false,
  cancelled: false,
};

/**
 * Bulk employee synchronisation with real progress. The employee list is read
 * first so the counter shows genuine totals ("45 / 120"), then the run walks
 * fixed-size chunks so Odoo is never flooded.
 *
 * Two modes: a dry run that only reports what would be created or updated
 * (nothing is written), and the real apply. Both can be cancelled — the run
 * stops at the current batch boundary so no request is abandoned mid-write,
 * and the final status is recorded in the activity log either way.
 */
export function BulkEmployeeSyncDialog({
  open,
  onOpenChange,
  disabled,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  onFinished?: () => void;
}) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [onlyFailedOrMissing, setOnlyFailedOrMissing] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [run, setRun] = useState<RunState>(EMPTY_RUN);
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);

  const candidates = useQuery({
    queryKey: ["odoo-employee-candidates", includeInactive, onlyFailedOrMissing],
    queryFn: () =>
      odooIntegrationService.employeeCandidates({ includeInactive, onlyFailedOrMissing }),
    enabled: open,
  });

  const rows = candidates.data ?? [];
  const nameById = useMemo(
    () => new Map(rows.map((row) => [row.id, row.name || row.loginId])),
    [rows],
  );

  const start = useCallback(
    async (mode: Mode) => {
      if (rows.length === 0) return;
      cancelled.current = false;
      setRunning(true);
      setRun({ ...EMPTY_RUN, mode, total: rows.length });

      let created = 0;
      let updated = 0;
      let failed = 0;
      let processed = 0;
      let stopped = false;
      const failures: { name: string; message: string }[] = [];

      try {
        for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
          if (cancelled.current) {
            stopped = true;
            break;
          }
          const chunk = rows.slice(index, index + CHUNK_SIZE).map((row) => row.id);
          const response =
            mode === "DRY_RUN"
              ? await odooIntegrationService.previewEmployeeChunk(chunk)
              : await odooIntegrationService.syncEmployeeChunk(chunk);

          if (!response.ok) {
            toast.error(response.message ?? "Synchronisation could not start.");
            break;
          }

          if (mode === "DRY_RUN") {
            for (const result of response.results as EmployeeSyncPreview[]) {
              if (result.action === "CREATE") created += 1;
              else if (result.action === "UPDATE") updated += 1;
              else {
                failed += 1;
                failures.push({
                  name: nameById.get(result.employeeId) ?? "Employee",
                  message: result.message ?? "This employee cannot be synchronised yet.",
                });
              }
            }
          } else {
            for (const result of response.results as EmployeeSyncOutcome[]) {
              if (result.outcome === "CREATED") created += 1;
              else if (result.outcome === "UPDATED") updated += 1;
              else {
                failed += 1;
                failures.push({
                  name: nameById.get(result.employeeId) ?? "Employee",
                  message: result.message ?? "This employee could not be synchronised.",
                });
              }
            }
          }

          processed += response.results.length;
          setRun({
            mode,
            processed,
            total: rows.length,
            created,
            updated,
            failed,
            failures,
            done: false,
            cancelled: false,
          });
        }

        setRun({
          mode,
          processed,
          total: rows.length,
          created,
          updated,
          failed,
          failures,
          done: true,
          cancelled: stopped,
        });

        // A cancelled run still gets a final status so the activity log always
        // reflects what actually happened.
        await odooIntegrationService.logBulkEmployeeSync({
          created,
          updated,
          failed,
          total: rows.length,
          cancelled: stopped,
          dryRun: mode === "DRY_RUN",
        });

        if (stopped) {
          toast.info(
            mode === "DRY_RUN"
              ? `Preview stopped after ${processed} of ${rows.length} employees.`
              : `Sync stopped after ${processed} of ${rows.length} employees. Completed records are saved.`,
          );
        } else if (mode === "DRY_RUN" && processed > 0) {
          toast.success(
            `Preview ready: ${created} to create, ${updated} to update${
              failed > 0 ? `, ${failed} blocked` : ""
            }.`,
          );
        } else if (failed === 0 && processed > 0) {
          toast.success(`Employees synchronised: ${created} created, ${updated} updated.`);
        } else if (processed > 0) {
          toast.warning(`Finished with ${failed} failure(s). See the details below.`);
        }

        if (mode === "APPLY") onFinished?.();
      } catch {
        toast.error(
          mode === "DRY_RUN"
            ? "The preview could not be completed. Nothing was changed."
            : "The synchronisation run stopped unexpectedly. Completed records are saved.",
        );
      } finally {
        setRunning(false);
      }
    },
    [nameById, onFinished, rows],
  );

  const percent = run.total === 0 ? 0 : Math.round((run.processed / run.total) * 100);
  const previewReady = run.done && run.mode === "DRY_RUN" && !run.cancelled && run.processed > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && running) cancelled.current = true;
        if (!next) setRun(EMPTY_RUN);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk employee sync</DialogTitle>
          <DialogDescription>
            Pushes Dayflow employees to Odoo in small batches. Records already linked are updated
            rather than duplicated. Start with a preview to see exactly what would change.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-include-inactive"
                checked={includeInactive}
                disabled={running}
                onCheckedChange={(checked) => setIncludeInactive(checked === true)}
              />
              <Label htmlFor="bulk-include-inactive">Include inactive employees</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-only-pending"
                checked={onlyFailedOrMissing}
                disabled={running}
                onCheckedChange={(checked) => setOnlyFailedOrMissing(checked === true)}
              />
              <Label htmlFor="bulk-only-pending">Only not-yet-synced or failed</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-dry-run"
                checked={dryRun}
                disabled={running}
                onCheckedChange={(checked) => setDryRun(checked === true)}
              />
              <Label htmlFor="bulk-dry-run">Dry run (preview only, nothing is written)</Label>
            </div>
          </div>

          {candidates.isPending ? (
            <LoadingState label="Counting employees…" />
          ) : candidates.isError ? (
            <ErrorState
              title="Employee list unavailable"
              description="We could not load the employees to synchronise."
              onRetry={() => void candidates.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Nothing to synchronise"
              description="No employees match the selected options."
            />
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {running || run.done
                    ? `${run.processed} / ${run.total} employees`
                    : `${rows.length} employee(s) queued`}
                </span>
                <span className="text-muted-foreground" aria-live="polite">
                  {running
                    ? `${run.mode === "DRY_RUN" ? "Previewing" : "Syncing"} — ${percent}%`
                    : run.cancelled
                      ? "Stopped"
                      : run.done
                        ? run.mode === "DRY_RUN"
                          ? "Preview complete"
                          : "Completed"
                        : "Ready"}
                </span>
              </div>
              <Progress value={running || run.done ? percent : 0} />
              {run.done || run.processed > 0 ? (
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground uppercase">
                      {run.mode === "DRY_RUN" ? "To create" : "Created"}
                    </dt>
                    <dd className="font-semibold">{run.created}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground uppercase">
                      {run.mode === "DRY_RUN" ? "To update" : "Updated"}
                    </dt>
                    <dd className="font-semibold">{run.updated}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground uppercase">
                      {run.mode === "DRY_RUN" ? "Blocked" : "Failed"}
                    </dt>
                    <dd className="font-semibold">{run.failed}</dd>
                  </div>
                </dl>
              ) : null}
              {previewReady ? (
                <p className="text-xs text-muted-foreground">
                  Nothing has been written to Odoo yet. Apply the sync to make these changes.
                </p>
              ) : null}
            </div>
          )}

          {run.failures.length > 0 ? (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-destructive/30 p-3">
              {run.failures.map((failure, index) => (
                <p key={`${failure.name}-${index}`} className="text-sm">
                  <span className="font-medium">{failure.name}: </span>
                  <span className="text-muted-foreground">{failure.message}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {running ? (
            <Button
              variant="destructive"
              onClick={() => {
                cancelled.current = true;
                toast.info("Stopping after the current batch…");
              }}
            >
              Cancel sync
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
          {previewReady ? (
            <Button
              onClick={() => void start("APPLY")}
              disabled={disabled || running || rows.length === 0}
            >
              Apply sync ({run.created + run.updated} record(s))
            </Button>
          ) : (
            <Button
              onClick={() => void start(dryRun ? "DRY_RUN" : "APPLY")}
              disabled={disabled || running || rows.length === 0 || candidates.isPending}
            >
              {running
                ? run.mode === "DRY_RUN"
                  ? "Previewing…"
                  : "Syncing…"
                : dryRun
                  ? "Run preview"
                  : run.done
                    ? "Run again"
                    : "Start sync"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
