import { AlertTriangle, Inbox, Loader2, ShieldAlert, SearchX } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StateShellProps = {
  icon: ReactNode;
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
  tone?: "neutral" | "warning" | "danger";
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
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground",
          tone === "warning" && "bg-accent/15 text-accent-foreground",
          tone === "danger" && "bg-destructive/10 text-destructive",
        )}
      >
        {icon}
      </span>
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground"
    >
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
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
