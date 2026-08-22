import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<StatTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border/80",
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60",
  warning: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
  danger: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60",
};

/**
 * Enterprise KPI tile. `context` is optional and must only ever carry real data —
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
    <Card className={cn("card-interactive border-border/80 shadow-xs", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          {Icon ? (
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-md border",
                TONE_CLASSES[tone],
              )}
            >
              <Icon className="size-4" />
            </span>
          ) : null}
        </div>

        <div className="mt-2 space-y-1">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="font-display text-2xl font-bold tracking-tight text-foreground">
              {value}
            </p>
          )}
          {context ? <div className="text-xs text-muted-foreground">{context}</div> : null}
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
  tone: "success" | "warning" | "danger" | "neutral" | "info";
  children: ReactNode;
}) {
  const dot =
    tone === "success"
      ? "bg-emerald-500"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "danger"
          ? "bg-red-500"
          : tone === "info"
            ? "bg-blue-500"
            : "bg-muted-foreground";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span aria-hidden="true" className={cn("size-2 rounded-full ring-2 ring-background", dot)} />
      {children}
    </span>
  );
}
