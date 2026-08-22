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
    <Card className="card-interactive group h-full border-border/80 shadow-xs transition-all hover:border-primary/40">
      <CardHeader className="space-y-2 p-5">
        <div className="flex items-center justify-between">
          <span
            aria-hidden="true"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border/80 bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-colors"
          >
            <Icon className="size-4" />
          </span>
          {to ? (
            <ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          ) : null}
        </div>
        <CardTitle className="font-display text-sm font-semibold text-foreground">{title}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{description}</CardDescription>
      </CardHeader>
      {pendingNote ? (
        <CardContent className="p-5 pt-0">
          <p className="rounded-md border border-dashed border-border bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            {pendingNote}
          </p>
        </CardContent>
      ) : null}
    </Card>
  );

  if (!to) return body;

  return (
    <Link
      to={to}
      className="block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={`${title} — ${ctaLabel ?? "open section"}`}
    >
      {body}
    </Link>
  );
}

export function DashboardGrid({ sections }: { sections: DashboardSectionProps[] }) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      {sections.map((section) => (
        <DashboardSection key={section.title} {...section} />
      ))}
    </div>
  );
}
