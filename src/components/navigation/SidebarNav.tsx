import { Link } from "@tanstack/react-router";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavGroup } from "@/config/navigation";

/**
 * Grouped sidebar navigation. In the collapsed desktop state only icons are
 * rendered, so each entry keeps an accessible name plus a tooltip.
 */
export function SidebarNav({
  groups,
  collapsed = false,
  onNavigate,
}: {
  groups: readonly NavGroup[];
  collapsed?: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            <span aria-hidden="true" className="mx-auto mb-1 h-px w-6 bg-border" />
          ) : (
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
              {group.label}
            </p>
          )}
          {group.items.map(({ label, to, icon: Icon }) => {
            const link = (
              <Link
                key={to}
                to={to}
                onClick={onNavigate}
                aria-label={label}
                className={`group flex items-center rounded-xl text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                }`}
                activeProps={{
                  className: "bg-primary/10 text-primary",
                  "aria-current": "page",
                }}
                activeOptions={{ exact: false }}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {collapsed ? null : <span className="truncate">{label}</span>}
              </Link>
            );

            if (!collapsed) return link;
            return (
              <Tooltip key={to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
