import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, PlugZap, Settings, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONNECTION_LABELS, type OdooConnectionState } from "@/lib/odoo/models";
import { odooIntegrationService } from "@/services/odoo/integrationService";

const TONE: Record<
  OdooConnectionState,
  { badge: "success" | "destructive" | "neutral" | "warning"; icon: typeof CheckCircle2 }
> = {
  CONNECTED: { badge: "success", icon: CheckCircle2 },
  DISCONNECTED: { badge: "destructive", icon: WifiOff },
  NOT_CONFIGURED: { badge: "neutral", icon: Settings },
  ERROR: { badge: "destructive", icon: WifiOff },
};

/**
 * Connection test panel. The state always comes from a real server-side
 * authentication round-trip — never from anything the browser can see — and
 * only a safe explanation is displayed, never credentials or provider output.
 */
export function OdooConnectionCard({
  configured,
  onTested,
  failureCount = 0,
}: {
  configured: boolean | undefined;
  onTested?: () => void;
  /** Recent failed sync operations, used for the "View failures" shortcut. */
  failureCount?: number;
}) {
  const test = useMutation({
    mutationFn: () => odooIntegrationService.testConnection(),
    onSuccess: (result) => {
      if (result.state === "CONNECTED") toast.success(result.message);
      else if (result.state === "NOT_CONFIGURED") toast.info(result.message);
      else toast.error(result.message);
      onTested?.();
    },
    onError: () => toast.error("We could not run the connection test."),
  });

  const state: OdooConnectionState =
    test.data?.state ?? (configured === false ? "NOT_CONFIGURED" : "DISCONNECTED");
  const tone = TONE[state];
  const Icon = tone.icon;
  const tested = Boolean(test.data);

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="flex flex-row items-start justify-between gap-4 p-5 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 font-display text-base font-semibold">
            <PlugZap className="size-4 text-primary" aria-hidden="true" />
            Odoo ERP Connection
          </CardTitle>
          <CardDescription>
            Live JSON-RPC / XML-RPC authenticated session with the configured Odoo ERP database.
          </CardDescription>
        </div>
        <Button onClick={() => test.mutate()} disabled={test.isPending} size="sm">
          {test.isPending ? "Testing…" : "Test Connection"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={tone.badge} className="gap-1.5 py-1 px-2.5 text-xs font-semibold">
            <Icon className="size-3.5" aria-hidden="true" />
            {CONNECTION_LABELS[state]}
          </Badge>
          {tested ? (
            <span className="text-xs text-muted-foreground">
              Last verified: {new Date(test.data!.checkedAt).toLocaleTimeString()}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {configured === false
                ? "Odoo ERP credentials pending configuration in server environment."
                : "Click Test Connection to verify live connectivity."}
            </span>
          )}
        </div>

        {failureCount > 0 ? (
          <Button asChild variant="outline" size="sm" className="h-7 text-xs text-destructive border-destructive/30">
            <Link to="/admin/integrations" search={{ status: "FAILED" }} hash="sync-activity">
              <AlertTriangle className="mr-1.5 size-3.5" aria-hidden="true" />
              View Sync Failures ({failureCount})
            </Link>
          </Button>
        ) : null}

        <p className="rounded-md border border-border/60 bg-muted/20 p-2.5 text-xs text-muted-foreground" role="status">
          {test.data?.message ??
            (configured === false
              ? "Set ODOO_BASE_URL, ODOO_DATABASE, ODOO_USERNAME, and ODOO_API_KEY in the server environment."
              : "Server credentials configured. Synchronisation commands will update records bidirectionally.")}
        </p>
      </CardContent>
    </Card>
  );
}
