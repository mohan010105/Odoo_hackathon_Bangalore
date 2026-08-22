import { Link, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export type QuickAction = {
  label: string;
  to: NonNullable<LinkProps["to"]>;
  icon: LucideIcon;
  primary?: boolean;
};

/** Compact row of jump-to links used in dashboard headers. */
export function QuickActions({ actions }: { actions: readonly QuickAction[] }) {
  return (
    <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          asChild
          size="sm"
          variant={action.primary ? "default" : "outline"}
        >
          <Link to={action.to}>
            <action.icon aria-hidden="true" className="size-4" />
            {action.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
