import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type DashboardSectionProps = {
  title: string;
  description: string;
  /** Shown when the module has no live data yet. */
  pendingNote?: string;
  icon: LucideIcon;
  /** When set, the whole tile links into that section. */
  to?: LinkProps["to"];
  ctaLabel?: string;
};

/**
 * Dashboard tile. When a destination is given the tile becomes a link into
 * that section; otherwise it shows an honest "not connected yet" note instead
 * of invented statistics.
 */
export function DashboardSection({
  title,
  description,
  pendingNote,
  icon: Icon,
  to,
  ctaLabel,
}: DashboardSectionProps) {
  const body = (
    <Card className="card-interactive h-full focus-within:border-primary/60">
      <CardHeader className="space-y-2">
        <span
          aria-hidden="true"
          className="inline-flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
        >
          <Icon className="size-4" />
        </span>
        <CardTitle className="font-display text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {to ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            {ctaLabel ?? "Open"}
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        ) : pendingNote ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {pendingNote}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );

  if (!to) return body;

  return (
    <Link
      to={to}
      className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={`${title} — ${ctaLabel ?? "open section"}`}
    >
      {body}
    </Link>
  );
}

export function DashboardGrid({ sections }: { sections: DashboardSectionProps[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sections.map((section) => (
        <DashboardSection key={section.title} {...section} />
      ))}
    </div>
  );
}
