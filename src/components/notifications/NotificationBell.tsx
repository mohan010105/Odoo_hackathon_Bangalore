import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { notificationService } from "@/services/notifications/notificationService";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function linkTarget(link: string) {
  const [path, query] = link.split("?");
  const search: Record<string, string> = {};
  if (query) {
    for (const [key, value] of new URLSearchParams(query).entries()) search[key] = value;
  }
  return { to: path ?? link, search };
}

/**
 * In-app notification centre. Employees see attendance corrections and leave
 * decisions here; the badge reflects unread items and refreshes in realtime.
 */
export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ["notifications", "mine"],
    queryFn: () => notificationService.list({ limit: 8 }),
  });

  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationService.unreadCount(),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("notifications-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const unreadCount = unread.data?.total ?? 0;

  const markRead = async (id: string) => {
    await notificationService.markAsRead(id);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAll = async () => {
    await notificationService.markAllAsRead();
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const handleNotificationClick = async (id: string, readAt: string | null) => {
    if (!readAt) {
      await markRead(id);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="justify-start gap-3"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell aria-hidden="true" className="size-4" /> Notifications
          {unreadCount > 0 ? (
            <Badge className="ml-auto" variant="default">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="font-display text-sm font-semibold">Notifications</p>
          {unreadCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => void markAll()}>
              Mark all read
            </Button>
          ) : null}
        </div>
        <ScrollArea className="max-h-80">
          {list.isLoading ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : (list.data?.rows ?? []).length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              You have no notifications yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(list.data?.rows ?? []).map((item) => (
                <li key={item.id} className={`px-3 py-3 ${!item.read_at ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeTime(item.created_at)}
                    </span>
                  </div>
                  {item.body ? (
                    <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.link ? (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => void handleNotificationClick(item.id, item.read_at)}
                      >
                        <Link
                          to={linkTarget(item.link).to}
                          search={linkTarget(item.link).search}
                        >
                          <span className="flex items-center gap-1">
                            Open <ExternalLink className="size-3" />
                          </span>
                        </Link>
                      </Button>
                    ) : null}
                    {!item.read_at ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground"
                        onClick={() => void markRead(item.id)}
                      >
                        Mark as read
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-border p-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => setOpen(false)}
          >
            <Link to="/employee/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
