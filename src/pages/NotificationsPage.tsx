import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  notificationService,
  type NotificationCategory,
  type NotificationRow,
} from "@/services/notifications/notificationService";

const FILTERS = [
  { id: "ALL", label: "All updates" },
  { id: "ATTENDANCE", label: "Attendance" },
  { id: "LEAVE", label: "Leave" },
  { id: "PAYROLL", label: "Payroll" },
  { id: "INTEGRATION", label: "Odoo sync" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

/** History page size for the "load more" control. */
const PAGE_SIZE = 10;

/**
 * Notification links are stored as plain paths that may carry a query string
 * (payroll alerts point at the payslip for one period). Split them so the
 * router receives the path and search params separately.
 */
function linkTarget(link: string) {
  const [path, query] = link.split("?");
  const search: Record<string, string> = {};
  if (query) {
    for (const [key, value] of new URLSearchParams(query).entries()) search[key] = value;
  }
  return { to: path ?? link, search };
}

function timestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Notification centre shared by both portals. Attendance and leave updates can
 * be viewed separately, each with its own unread count and its own
 * "mark all read" action scoped to the active filter.
 */
export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterId>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const category: NotificationCategory | undefined =
    filter === "ALL" ? undefined : (filter as NotificationCategory);

  // Paged history: unread items first, then newest first, with a "load more"
  // control instead of an unbounded list.
  const notifications = useInfiniteQuery({
    queryKey: ["notifications", "history", filter, unreadOnly],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      notificationService.list({
        ...(category ? { category } : {}),
        unreadOnly,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });

  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationService.unreadCount(),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const unreadFor = (id: FilterId) =>
    id === "ALL" ? (unread.data?.total ?? 0) : (unread.data?.byCategory[id] ?? 0);

  const markRead = async (row: NotificationRow) => {
    if (row.read_at) return;
    try {
      await notificationService.markAsRead(row.id);
      refresh();
    } catch {
      toast.error("We could not update that notification.");
    }
  };

  const markAll = async () => {
    try {
      await notificationService.markAllAsRead(category);
      toast.success(
        category ? `${category.toLowerCase()} updates marked as read` : "All notifications marked as read",
      );
      refresh();
    } catch {
      toast.error("We could not update your notifications.");
    }
  };

  const rows = notifications.data?.pages.flatMap((page) => page.rows) ?? [];
  const total = notifications.data?.pages[0]?.total ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notifications"
        description="Attendance corrections, leave decisions and payroll alerts."
        actions={
          <>
            <Button variant="outline" onClick={() => setUnreadOnly((value) => !value)} aria-pressed={unreadOnly}>
              {unreadOnly ? "Show all" : "Show unread only"}
            </Button>
            <Button onClick={markAll} disabled={unreadFor(filter) === 0}>
              {filter === "ALL" ? "Mark all as read" : `Mark all ${filter.toLowerCase()} as read`}
            </Button>
          </>
        }
      />

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter notifications by type"
      >
        {FILTERS.map((item) => {
          const count = unreadFor(item.id);
          const active = filter === item.id;
          return (
            <Button
              key={item.id}
              role="tab"
              aria-selected={active}
              variant={active ? "default" : "outline"}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              {count > 0 ? (
                <Badge className="ml-2" variant={active ? "secondary" : "default"}>
                  {count}
                </Badge>
              ) : null}
            </Button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            {FILTERS.find((item) => item.id === filter)?.label}
          </CardTitle>
          <CardDescription>
            Unread first, then newest. Showing {rows.length} of {total}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.isError ? (
            <p role="alert" className="text-sm text-destructive">
              We could not load your notifications.
            </p>
          ) : notifications.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading notifications…</p>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              {unreadOnly ? "No unread notifications for this filter." : "No notifications yet."}
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={`rounded-lg border p-3 ${
                    row.read_at ? "border-border" : "border-primary/40 bg-primary/5"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">{row.title}</p>
                      {row.body ? (
                        <p className="text-sm text-muted-foreground">{row.body}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">{timestamp(row.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{row.category}</Badge>
                      {row.link ? (
                        <Button asChild size="sm" variant="outline" onClick={() => void markRead(row)}>
                          <Link
                            to={linkTarget(row.link).to}
                            search={linkTarget(row.link).search}
                          >
                            {row.category === "PAYROLL" ? "View payslip" : "Open"}
                          </Link>
                        </Button>
                      ) : null}
                      {row.read_at ? null : (
                        <Button size="sm" variant="ghost" onClick={() => void markRead(row)}>
                          Mark read
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {notifications.hasNextPage ? (
            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void notifications.fetchNextPage()}
                disabled={notifications.isFetchingNextPage}
              >
                {notifications.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
