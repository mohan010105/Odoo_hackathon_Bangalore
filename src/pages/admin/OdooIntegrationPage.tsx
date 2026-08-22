import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Users } from "lucide-react";
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
  return value ? new Date(value).toLocaleString() : "Never";
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
        title="Odoo integration"
        description="Test the connection, monitor synchronisation health and re-run syncs safely."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refreshAll}>
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setErrorEntity(undefined);
                setErrorsOpen(true);
              }}
            >
              <AlertTriangle className="mr-2 size-4" aria-hidden="true" />
              Sync errors
              {data && data.errorCount > 0 ? (
                <Badge variant="destructive" className="ml-2">
                  {data.errorCount}
                </Badge>
              ) : null}
            </Button>
            <Button onClick={() => setBulkOpen(true)} disabled={configured === false}>
              <Users className="mr-2 size-4" aria-hidden="true" />
              Bulk employee sync
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Last successful sync</CardDescription>
              </CardHeader>
              <CardContent className="text-sm font-semibold">
                {formatTime(data.lastSuccessfulSyncAt)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Last attempt</CardDescription>
              </CardHeader>
              <CardContent className="text-sm font-semibold">
                {formatTime(data.lastSyncAttemptAt)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Recent failures</CardDescription>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{data.errorCount}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Payroll module</CardDescription>
              </CardHeader>
              <CardContent className="text-sm font-semibold">
                {data.payrollAvailable === null
                  ? "Unknown"
                  : data.payrollAvailable
                    ? "Available"
                    : "Not installed"}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>Synchronisation by module</CardTitle>
                <CardDescription>
                  Re-running a sync is safe: linked records are updated instead of duplicated.
                </CardDescription>
              </div>
              <Button
                variant="secondary"
                onClick={() => setConfirmFullSync(true)}
                disabled={busy || configured === false}
              >
                {fullSync.isPending ? "Syncing…" : "Sync everything"}
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-right">Synced</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stats.map((stat) => (
                    <TableRow key={stat.entity}>
                      <TableCell className="font-medium">{ENTITY_LABELS[stat.entity]}</TableCell>
                      <TableCell className="text-right">{stat.synced}</TableCell>
                      <TableCell className="text-right">{stat.pending}</TableCell>
                      <TableCell className="text-right">{stat.failed}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {stat.failed > 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
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
                            disabled={busy || configured === false}
                            onClick={() => entitySync.mutate(stat.entity)}
                          >
                            {entitySync.isPending && entitySync.variables === stat.entity
                              ? "Syncing…"
                              : "Retry sync"}
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
              This may create or update records in the connected Odoo environment. Records already
              linked to Odoo are updated, never duplicated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => fullSync.mutate()}>Start sync</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={summary !== null} onOpenChange={(open) => !open && setSummary(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Synchronisation summary</AlertDialogTitle>
            <AlertDialogDescription>
              {summary && summary.some((row) => row.failed > 0)
                ? "Synchronisation completed with some failures. Open sync errors for safe details."
                : "All eligible records were synchronised successfully."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="overflow-x-auto">
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
                    <TableCell className="font-medium">{ENTITY_LABELS[row.entity]}</TableCell>
                    <TableCell className="text-right">{row.succeeded + row.failed}</TableCell>
                    <TableCell className="text-right">{row.succeeded}</TableCell>
                    <TableCell className="text-right">{row.failed}</TableCell>
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
