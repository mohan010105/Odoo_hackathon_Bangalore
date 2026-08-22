import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CircleHelp,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Brand } from "@/components/common/Brand";
import { Breadcrumbs, crumbsFor } from "@/components/layout/Breadcrumbs";
import { SessionTimeout } from "@/components/layout/SessionTimeout";
import { SidebarNav } from "@/components/navigation/SidebarNav";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavGroup, NavItem } from "@/config/navigation";
import { useAuth } from "@/hooks/useAuth";

const COLLAPSE_KEY = "dayflow.sidebar.collapsed";

/** Longest matching nav entry gives the current page its title. */
function currentPageLabel(items: readonly NavItem[], pathname: string) {
  const match = items
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? "Dayflow";
}

export function AppShell({
  groups,
  workspaceLabel,
  children,
}: {
  groups: readonly NavGroup[];
  workspaceLabel: string;
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const isAdmin = user?.role === "ADMIN";
  const pageLabel = currentPageLabel(items, pathname);
  const profileTo = isAdmin ? "/admin/profile" : "/employee/profile";
  const settingsTo = isAdmin ? "/admin/settings" : "/employee/settings";
  const helpTo = isAdmin ? "/admin/help" : "/employee/help";
  const homeTo = isAdmin ? "/admin/dashboard" : "/employee/dashboard";
  const crumbs = crumbsFor(items, pathname, homeTo);

  // Sidebar width is a UI preference only — never authentication state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* preference persistence is best-effort */
      }
      return next;
    });
  };

  /**
   * Secure sign-out: stop in-flight requests, drop every cached row of
   * protected data, clear the session, then replace history so the back button
   * cannot restore an authenticated screen.
   */
  const handleSignOut = async () => {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await signOut();
      toast.success("Signed out", { description: "Your session on this device is cleared." });
    } catch {
      toast.error("We could not sign you out cleanly. Please close this tab.");
    } finally {
      setMobileOpen(false);
      navigate({ to: "/login", replace: true });
    }
  };

  const displayName = user?.fullName?.trim() || user?.email || "Signed in";
  const initials = (user?.fullName ?? user?.email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const roleLabel = user?.role === "ADMIN" ? "Admin / HR" : "Employee";

  const sidebarBody = (options?: { onNavigate?: () => void; compact?: boolean }) => {
    const compact = options?.compact ?? false;
    return (
      <div className={`flex h-full flex-col gap-6 py-4 ${compact ? "px-2" : "px-3"}`}>
        <div className={compact ? "flex justify-center" : "px-1"}>
          <Brand iconOnly={compact} />
        </div>
        {compact ? null : (
          <Badge variant="secondary" className="ml-1 w-fit text-[11px] tracking-wide uppercase">
            {workspaceLabel}
          </Badge>
        )}
        <div className="flex-1 overflow-y-auto">
          <SidebarNav
            groups={groups}
            collapsed={compact}
            {...(options?.onNavigate ? { onNavigate: options.onNavigate } : {})}
          />
        </div>
        <Separator />
        <div className="space-y-1">
          <Link
            to={profileTo}
            onClick={options?.onNavigate}
            aria-label="View my profile"
            className={`flex items-center rounded-xl py-2 transition-colors hover:bg-secondary ${
              compact ? "justify-center px-0" : "gap-3 px-2"
            }`}
          >
            <span
              aria-hidden="true"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
            >
              {initials || "DF"}
            </span>
            {compact ? null : (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {displayName}
                </span>
                <span className="block text-xs text-muted-foreground">{roleLabel}</span>
              </span>
            )}
          </Link>
          <Button
            variant="ghost"
            className={`w-full text-destructive hover:text-destructive ${
              compact ? "justify-center px-0" : "justify-start gap-3"
            }`}
            onClick={handleSignOut}
            aria-label="Log out"
          >
            <LogOut aria-hidden="true" className="size-4" />
            {compact ? null : "Log out"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={`min-h-screen bg-background lg:grid ${
          collapsed ? "lg:grid-cols-[4.5rem_1fr]" : "lg:grid-cols-[16.5rem_1fr]"
        }`}
      >
        <SessionTimeout />
        <aside className="sticky top-0 hidden h-screen border-r border-border bg-sidebar lg:block">
          {sidebarBody({ compact: collapsed })}
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Open navigation"
                  className="lg:hidden"
                >
                  <Menu aria-hidden="true" className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 overflow-y-auto p-0">
                <SheetTitle className="sr-only">Dayflow navigation</SheetTitle>
                {sidebarBody({ onNavigate: () => setMobileOpen(false) })}
              </SheetContent>
            </Sheet>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-pressed={collapsed}
                  onClick={toggleCollapsed}
                >
                  {collapsed ? (
                    <PanelLeftOpen aria-hidden="true" className="size-4" />
                  ) : (
                    <PanelLeftClose aria-hidden="true" className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground lg:text-base">
                {pageLabel}
              </p>
              <div className="hidden min-w-0 sm:block">
                <Breadcrumbs crumbs={crumbs} />
              </div>
            </div>

            {isAdmin ? (
              <form
                role="search"
                className="hidden md:block"
                onSubmit={(event) => {
                  event.preventDefault();
                  const term = search.trim();
                  void navigate({
                    to: "/admin/employees",
                    search: term ? { q: term } : {},
                  });
                }}
              >
                <label className="relative block">
                  <span className="sr-only">Search employees</span>
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search employees…"
                    className="w-56 pl-9"
                  />
                </label>
              </form>
            ) : null}

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label="Account menu" className="gap-2 px-2">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                  >
                    {initials || "DF"}
                  </span>
                  <span className="hidden min-w-0 text-left lg:block">
                    <span className="block max-w-36 truncate text-sm font-medium">
                      {displayName}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{roleLabel}</span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="space-y-1 font-normal">
                  <span className="block truncate text-sm font-medium">{displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user?.email ?? "—"}
                  </span>
                  <Badge variant="secondary" className="text-[10px] tracking-wide uppercase">
                    {roleLabel}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={profileTo}>
                    <UserRound aria-hidden="true" className="mr-2 size-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={settingsTo}>
                    <Settings aria-hidden="true" className="mr-2 size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={helpTo}>
                    <CircleHelp aria-hidden="true" className="mr-2 size-4" /> Help
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleSignOut()} className="text-destructive">
                  <LogOut aria-hidden="true" className="mr-2 size-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
