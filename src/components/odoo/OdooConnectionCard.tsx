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
  { badge: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }
> = {
  CONNECTED: { badge: "default", icon: CheckCircle2 },
  DISCONNECTED: { badge: "destructive", icon: WifiOff },
  NOT_CONFIGURED: { badge: "outline", icon: Settings },
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="size-5 text-primary" aria-hidden="true" />
            Odoo connection
          </CardTitle>
          <CardDescription>
            Runs a live authentication check against the configured Odoo environment.
          </CardDescription>
        </div>
        <Button onClick={() => test.mutate()} disabled={test.isPending}>
          {test.isPending ? "Testing…" : "Test connection"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={tone.badge} className="gap-1.5">
            <Icon className="size-3.5" aria-hidden="true" />
            {CONNECTION_LABELS[state]}
          </Badge>
          {tested ? (
            <span className="text-sm text-muted-foreground">
              Checked {new Date(test.data!.checkedAt).toLocaleString()}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {configured === false
                ? "Odoo credentials have not been added yet."
                : "Run the test to confirm the live connection state."}
            </span>
          )}
        </div>

        {failureCount > 0 ? (
          <Button asChild variant="outline" size="sm" className="w-fit">
            {/* Opens the activity log pre-filtered to failed entries. */}
            <Link to="/admin/integrations" search={{ status: "FAILED" }} hash="sync-activity">
              <AlertTriangle className="mr-2 size-4 text-destructive" aria-hidden="true" />
              View failures ({failureCount})
            </Link>
          </Button>
        ) : null}

        <p className="text-sm text-muted-foreground" role="status">
          {test.data?.message ??
            (configured === false
              ? "Add the Odoo address, database, user and API key on the server to enable synchronisation."
              : "Credentials are configured. The state above reflects the last test you ran in this session.")}
        </p>
      </CardContent>
    </Card>
  );
}
