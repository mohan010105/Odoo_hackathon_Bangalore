import { AlertTriangle, Inbox, Loader2, ShieldAlert, SearchX } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StateShellProps = {
  icon: ReactNode;
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
  tone?: "neutral" | "warning" | "danger" | "info";
  className?: string;
};

function StateShell({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: StateShellProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/80 bg-card/50 px-6 py-10 text-center shadow-xs",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-lg border bg-muted/60 text-muted-foreground",
          tone === "warning" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
          tone === "danger" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
          tone === "info" && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
        )}
      >
        {icon}
      </span>
      <div className="space-y-1">
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="max-w-md text-xs text-muted-foreground leading-relaxed">{description}</p> : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2.5 px-6 py-10 text-xs font-medium text-muted-foreground"
    >
      <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StateShell
      icon={<Inbox className="size-5" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert">
      <StateShell
        tone="danger"
        icon={<AlertTriangle className="size-5" />}
        title={title}
        description={description}
        action={
          onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

export function UnauthorizedState({
  description = "You don't have permission to view this area. If you believe this is a mistake, contact your HR administrator.",
  action,
}: {
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div role="alert">
      <StateShell
        tone="warning"
        icon={<ShieldAlert className="size-5" />}
        title="Access restricted"
        description={description}
        action={action}
      />
    </div>
  );
}

export function NotFoundState({ action }: { action?: ReactNode }) {
  return (
    <StateShell
      icon={<SearchX className="size-5" />}
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      action={action}
    />
  );
}
