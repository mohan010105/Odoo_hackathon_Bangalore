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
    <nav aria-label="Main navigation" className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            <span aria-hidden="true" className="mx-auto my-1.5 h-px w-5 bg-border/80" />
          ) : (
            <p className="px-2.5 pb-1 text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase">
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
                className={`group flex items-center rounded-md text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-1.5"
                }`}
                activeProps={{
                  className: "bg-primary/10 text-primary font-semibold shadow-xs border-l-2 border-primary rounded-l-none",
                  "aria-current": "page",
                }}
                activeOptions={{ exact: false }}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0 transition-transform group-hover:scale-105" />
                {collapsed ? null : <span className="truncate text-[13px]">{label}</span>}
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
