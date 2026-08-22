import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "primary" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<StatTone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-chart-5/15 text-chart-5",
  warning: "bg-accent/20 text-accent-foreground",
  danger: "bg-destructive/10 text-destructive",
};

/**
 * Shared KPI tile. `context` is optional and must only ever carry real data —
 * never an invented trend.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  context,
  loading = false,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  context?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("card-interactive", className)}>
      <CardContent className="flex items-start gap-4 p-5">
        {Icon ? (
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
              TONE_CLASSES[tone],
            )}
          >
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0 space-y-1">
          {loading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className="text-2xl leading-none font-semibold tracking-tight text-foreground">
              {value}
            </p>
          )}
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {context ? <p className="text-xs text-muted-foreground">{context}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Status dot + label used for connection and record states. */
export function StatusIndicator({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
}) {
  const dot =
    tone === "success"
      ? "bg-chart-5"
      : tone === "warning"
        ? "bg-accent"
        : tone === "danger"
          ? "bg-destructive"
          : "bg-muted-foreground";

  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
      <span aria-hidden="true" className={cn("size-2 rounded-full", dot)} />
      {children}
    </span>
  );
}
