import { FileDown, ListChecks, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ENTITY_LABELS } from "@/lib/odoo/models";
import { recommendedSteps, type RetryAttempt } from "@/lib/odoo/retryHistory";
import type { OdooSyncLog } from "@/services/odoo/integrationService";

/** Filesystem-safe slug used to build a default export file name. */
function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Default name identifies the module, the record and the day of the export. */
function defaultFileName(row: OdooSyncLog) {
  const parts = [
    "odoo-sync-error",
    slug(row.entity_type),
    slug(row.record_label ?? row.id.slice(0, 8)),
    new Date().toISOString().slice(0, 10),
  ].filter(Boolean);
  return parts.join("-");
}

/**
 * Expanded view of one synchronisation log row: the full (safe) error payload,
 * recommended next steps for its error category, and the retry attempt history
 * recorded in this session. Credentials and raw provider output never reach the
 * browser, so the payload here is the categorised record only.
 */
export function SyncLogDetailDrawer({
  row,
  attempts,
  onOpenChange,
  onRetry,
  retrying,
}: {
  row: OdooSyncLog | null;
  attempts: RetryAttempt[];
  onOpenChange: (open: boolean) => void;
  onRetry: (row: OdooSyncLog) => void;
  retrying: boolean;
}) {
  const payload = row
    ? {
        logId: row.id,
        module: row.entity_type,
        direction: row.direction,
        status: row.status,
        errorCode: row.error_code,
        message: row.message,
        localRecordId: row.local_id,
        odooId: row.odoo_id,
        durationMs: row.duration_ms,
        recordedAt: row.created_at,
        retryable: row.retryable,
      }
    : null;

  const [fileName, setFileName] = useState("");

  // Reset the suggested name whenever a different log row is opened.
  useEffect(() => {
    setFileName(row ? defaultFileName(row) : "");
  }, [row]);

  const downloadReport = () => {
    if (!row || !payload) return;
    const lastAttempt = attempts.at(-1);
    const report = {
      generatedAt: new Date().toISOString(),
      module: ENTITY_LABELS[row.entity_type],
      record: row.record_label ?? null,
      errorPayload: payload,
      recommendedSteps: recommendedSteps(row.error_code),
      retryRun: {
        attempts: attempts.length,
        lastOutcome: lastAttempt?.outcome ?? null,
        lastAttemptedAt: lastAttempt?.attemptedAt ?? null,
      },
      retryHistory: attempts,
    };
    const safeName = slug(fileName) || defaultFileName(row);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Error report downloaded", {
      description: `${safeName}.json · ${attempts.length} retry attempt${
        attempts.length === 1 ? "" : "s"
      } included.`,
    });
  };


  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {row && payload ? (
          <>
            <SheetHeader>
              <SheetTitle>{row.record_label ?? "Unlabelled record"}</SheetTitle>
              <SheetDescription>
                {ENTITY_LABELS[row.entity_type]} · {new Date(row.created_at).toLocaleString()}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.status === "FAILED" ? "destructive" : "secondary"}>
                  {row.status}
                </Badge>
                {row.error_code ? <Badge variant="outline">{row.error_code}</Badge> : null}
                {row.odoo_id ? <Badge variant="outline">Odoo id {row.odoo_id}</Badge> : null}
              </div>

              <p className="text-sm text-muted-foreground">
                {row.message ?? "Synchronisation with Odoo failed."}
              </p>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Error payload</h3>
                <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </section>

              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <ListChecks aria-hidden="true" className="size-4" />
                  Recommended next steps
                </h3>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {recommendedSteps(row.error_code).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Retry attempt history</h3>
                {attempts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No retry has been attempted for this entry in this session.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {attempts.map((attempt, index) => (
                      <li
                        key={`${attempt.attemptedAt}-${index}`}
                        className="rounded-lg border border-border p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">Attempt {index + 1}</span>
                          <Badge
                            variant={attempt.outcome === "SUCCESS" ? "default" : "destructive"}
                          >
                            {attempt.outcome === "SUCCESS" ? "Re-synced" : "Failed"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(attempt.attemptedAt).toLocaleString()}
                          {attempt.odooId ? ` · Odoo request id ${attempt.odooId}` : ""}
                          {attempt.errorCode ? ` · ${attempt.errorCode}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{attempt.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="space-y-1.5">
                <Label htmlFor="error-report-name">Error report file name</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="error-report-name"
                    value={fileName}
                    onChange={(event) => setFileName(event.target.value)}
                    placeholder={defaultFileName(row)}
                  />
                  <span className="text-sm text-muted-foreground">.json</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {row.status === "FAILED" && row.local_id ? (
                  <Button disabled={retrying} onClick={() => onRetry(row)}>
                    <RefreshCw
                      aria-hidden="true"
                      className={`mr-2 size-4 ${retrying ? "animate-spin" : ""}`}
                    />
                    {retrying ? "Retrying…" : "Retry this record"}
                  </Button>
                ) : null}
                <Button variant="outline" onClick={downloadReport}>
                  <FileDown aria-hidden="true" className="mr-2 size-4" />
                  Download error report
                </Button>
              </div>

            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
