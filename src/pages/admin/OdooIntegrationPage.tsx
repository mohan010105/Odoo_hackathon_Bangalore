import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Users, Layers, Play, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingState } from "@/components/common/states";
import { BulkEmployeeSyncDialog } from "@/components/odoo/BulkEmployeeSyncDialog";
import { OdooConnectionCard } from "@/components/odoo/OdooConnectionCard";
import { SyncActivityLog } from "@/components/odoo/SyncActivityLog";
import { SyncErrorDrawer } from "@/components/odoo/SyncErrorDrawer";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ENTITY_LABELS, type OdooEntity, type SyncRunResult } from "@/lib/odoo/models";
import { odooIntegrationService } from "@/services/odoo/integrationService";

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Never";
}

/**
 * Admin Odoo integration workspace: connection test, sync health, manual
 * controls per entity, bulk employee sync with progress, and safe error detail.
 */
export function OdooIntegrationPage() {
  const queryClient = useQueryClient();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [errorEntity, setErrorEntity] = useState<OdooEntity | undefined>(undefined);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [confirmFullSync, setConfirmFullSync] = useState(false);
  const [summary, setSummary] = useState<SyncRunResult[] | null>(null);

  const overview = useQuery({
    queryKey: ["odoo-overview"],
    queryFn: () => odooIntegrationService.overview(),
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["odoo-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["odoo-sync-logs"] });
    void queryClient.invalidateQueries({ queryKey: ["odoo-sync-errors"] });
  };

  const entitySync = useMutation({
    mutationFn: (entity: OdooEntity) => odooIntegrationService.runEntitySync(entity),
    onSuccess: (result, entity) => {
      if (!result.ok) toast.error(result.message ?? "Synchronisation could not start.");
      else {
        const failed = result.results.filter((row) => row.status === "FAILED").length;
        if (failed > 0) toast.warning(`${ENTITY_LABELS[entity]} sync finished with ${failed} issue(s).`);
        else toast.success(`${ENTITY_LABELS[entity]} synchronised.`);
      }
      refreshAll();
    },
    onError: () => toast.error("The synchronisation could not be completed."),
  });

  const fullSync = useMutation({
    mutationFn: () => odooIntegrationService.runFullSync(),
    onSuccess: (result) => {
      if (!result.ok) toast.error(result.message ?? "Synchronisation could not start.");
      else {
        setSummary(result.results);
        toast.success("Synchronisation completed.");
      }
      refreshAll();
    },
    onError: () => toast.error("The synchronisation could not be completed."),
  });

  const data = overview.data;
  const configured = data?.configured;
  const busy = entitySync.isPending || fullSync.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Odoo ERP Integration"
        description="Bidirectional data synchronization console between Dayflow HRMS and connected Odoo ERP instances."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshAll}>
              <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setErrorEntity(undefined);
                setErrorsOpen(true);
              }}
            >
              <AlertTriangle className="mr-1.5 size-3.5 text-destructive" aria-hidden="true" />
              Sync Errors
              {data && data.errorCount > 0 ? (
                <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {data.errorCount}
                </Badge>
              ) : null}
            </Button>
            <Button size="sm" onClick={() => setBulkOpen(true)} disabled={configured === false}>
              <Users className="mr-1.5 size-3.5" aria-hidden="true" />
              Bulk Employee Sync
            </Button>
          </div>
        }
      />

      <OdooConnectionCard
        configured={configured}
        onTested={refreshAll}
        failureCount={data?.errorCount ?? 0}
      />

      {overview.isPending ? (
        <LoadingState label="Loading integration health…" />
      ) : overview.isError ? (
        <ErrorState
          title="Integration status unavailable"
          description="We could not load the synchronisation overview."
          onRetry={() => void overview.refetch()}
        />
      ) : data ? (
        <>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="p-4 pb-1">
                <CardDescription className="text-[11px] font-semibold tracking-wider uppercase">Last Successful Sync</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 text-base font-bold font-display text-foreground">
                {formatTime(data.lastSuccessfulSyncAt)}
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="p-4 pb-1">
                <CardDescription className="text-[11px] font-semibold tracking-wider uppercase">Last Sync Attempt</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 text-base font-bold font-display text-foreground">
                {formatTime(data.lastSyncAttemptAt)}
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="p-4 pb-1">
                <CardDescription className="text-[11px] font-semibold tracking-wider uppercase">Recent Failures</CardDescription>
              </CardHeader>
              <CardContent className={`p-4 pt-1 text-2xl font-bold font-display ${data.errorCount > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                {data.errorCount}
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="p-4 pb-1">
                <CardDescription className="text-[11px] font-semibold tracking-wider uppercase">Odoo Payroll Module</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 text-base font-bold font-display text-foreground">
                {data.payrollAvailable === null
                  ? "Auto-detecting"
                  : data.payrollAvailable
                    ? "Available"
                    : "Not Installed"}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/80 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between gap-4 p-5 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  <CardTitle className="font-display text-base font-semibold">Synchronization Matrix</CardTitle>
                </div>
                <CardDescription>
                  Module-by-module synchronization status. Linked records are safely updated without duplication.
                </CardDescription>
              </div>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={() => setConfirmFullSync(true)}
                disabled={busy || configured === false}
              >
                <Play className="size-3.5" />
                {fullSync.isPending ? "Syncing All…" : "Sync Everything"}
              </Button>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module / Entity</TableHead>
                    <TableHead className="text-right">Synced</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stats.map((stat) => (
                    <TableRow key={stat.entity}>
                      <TableCell className="font-medium text-foreground">
                        {ENTITY_LABELS[stat.entity]}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                        {stat.synced}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {stat.pending}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums font-semibold">
                        {stat.failed > 0 ? (
                          <span className="text-destructive">{stat.failed}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {stat.failed > 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => {
                                setErrorEntity(stat.entity);
                                setErrorsOpen(true);
                              }}
                            >
                              Details
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={busy || configured === false}
                            onClick={() => entitySync.mutate(stat.entity)}
                          >
                            {entitySync.isPending && entitySync.variables === stat.entity
                              ? "Syncing…"
                              : "Sync now"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      <SyncActivityLog />

      <BulkEmployeeSyncDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        disabled={configured === false}
        onFinished={refreshAll}
      />
      <SyncErrorDrawer open={errorsOpen} onOpenChange={setErrorsOpen} entity={errorEntity} />

      <AlertDialog open={confirmFullSync} onOpenChange={setConfirmFullSync}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Synchronise Dayflow data with Odoo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will run an authenticated batch sync against the connected Odoo database. Records already
              linked to Odoo are updated, never duplicated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => fullSync.mutate()}>Start Sync</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={summary !== null} onOpenChange={(open) => !open && setSummary(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <AlertDialogTitle>Synchronisation Complete</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              {summary && summary.some((row) => row.failed > 0)
                ? "Synchronisation completed with some warnings. Open sync errors for details."
                : "All eligible records were synchronised successfully with Odoo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="overflow-x-auto py-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead className="text-right">Processed</TableHead>
                  <TableHead className="text-right">Succeeded</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary ?? []).map((row) => (
                  <TableRow key={row.entity}>
                    <TableCell className="font-medium text-xs">{ENTITY_LABELS[row.entity]}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{row.succeeded + row.failed}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-emerald-600">{row.succeeded}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-destructive">{row.failed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSummary(null)}>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
