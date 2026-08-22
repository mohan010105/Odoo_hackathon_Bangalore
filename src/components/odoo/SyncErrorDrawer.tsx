import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ENTITY_LABELS, type OdooEntity } from "@/lib/odoo/models";
import { odooIntegrationService, type OdooSyncLog } from "@/services/odoo/integrationService";

/**
 * Per-operation failure details. Only categorised, plain-language messages are
 * shown: raw Odoo responses, credentials and stack traces never leave the
 * server, and retries reuse the idempotent mapping so nothing is duplicated.
 */
export function SyncErrorDrawer({
  open,
  onOpenChange,
  entity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity?: OdooEntity | undefined;
}) {
  const queryClient = useQueryClient();

  const logs = useQuery({
    queryKey: ["odoo-sync-errors", entity ?? "ALL"],
    queryFn: () =>
      odooIntegrationService.logs({
        onlyErrors: true,
        limit: 100,
        ...(entity ? { entity } : {}),
      }),
    enabled: open,
  });

  const retry = useMutation({
    mutationFn: ({ row }: { row: OdooSyncLog }) =>
      odooIntegrationService.retryRecord(row.entity_type, row.local_id ?? ""),
    onSuccess: (result) => {
      const outcome = result as { ok?: boolean; message?: string };
      if (outcome.ok === false) toast.error(outcome.message ?? "The retry did not succeed.");
      else toast.success("Record re-synchronised.");
      void queryClient.invalidateQueries({ queryKey: ["odoo-sync-errors"] });
      void queryClient.invalidateQueries({ queryKey: ["odoo-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["odoo-sync-logs"] });
    },
    onError: () => toast.error("The retry could not be completed."),
  });

  const rows = logs.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Sync error details</SheetTitle>
          <SheetDescription>
            Failed synchronisation operations{entity ? ` for ${ENTITY_LABELS[entity]}` : ""}, newest
            first. Retrying is safe — records are matched, not duplicated.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {logs.isPending ? (
            <LoadingState label="Loading failures…" />
          ) : logs.isError ? (
            <ErrorState
              title="Unable to load failures"
              description="We could not read the synchronisation history."
              onRetry={() => void logs.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No failures recorded"
              description="Every recent synchronisation operation succeeded."
            />
          ) : (
            rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{row.record_label ?? "Unlabelled record"}</p>
                    <p className="text-xs text-muted-foreground">
                      {ENTITY_LABELS[row.entity_type]} · {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={row.retryable ? "secondary" : "destructive"}>
                    {row.retryable ? "Retryable" : "Needs attention"}
                  </Badge>
                </div>

                <p className="mt-3 text-sm text-muted-foreground">
                  {row.message ?? "Synchronisation with Odoo failed."}
                </p>

                {row.local_id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate({ row })}
                  >
                    <RefreshCw className="mr-2 size-3.5" aria-hidden="true" />
                    Retry this record
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
