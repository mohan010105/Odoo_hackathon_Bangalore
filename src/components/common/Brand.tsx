import { cn } from "@/lib/utils";
import { clientEnv } from "@/config/env";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-base font-semibold tracking-tight text-primary-foreground",
        className,
      )}
    >
      D
    </span>
  );
}

export function Brand({
  withTagline = false,
  iconOnly = false,
  className,
}: {
  withTagline?: boolean;
  iconOnly?: boolean;
  className?: string;
}) {
  if (iconOnly) {
    return (
      <span className={cn("flex items-center", className)}>
        <BrandMark />
        <span className="sr-only">{clientEnv.appName}</span>
      </span>
    );
  }
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <BrandMark />
      <span className="flex flex-col leading-tight">
        <span className="font-display text-base font-semibold tracking-tight text-foreground">
          {clientEnv.appName}
        </span>
        {withTagline ? (
          <span className="text-xs text-muted-foreground">{clientEnv.appTagline}</span>
        ) : null}
      </span>
    </span>
  );
}

