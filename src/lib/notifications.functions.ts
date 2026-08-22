import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const COLUMNS = "id, title, body, category, link, read_at, created_at";

/** Categories the notification centre can filter by. */
export const NOTIFICATION_CATEGORIES = [
  "ATTENDANCE",
  "LEAVE",
  "PAYROLL",
  "INTEGRATION",
  "GENERAL",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

const listSchema = z.object({
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  unreadOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).max(1000).default(0),
});

const categorySchema = z.object({ category: z.enum(NOTIFICATION_CATEGORIES).optional() });

/**
 * One page of the signed-in user's notifications (RLS scopes the rows).
 * Unread items come first, then newest first inside each group, so a
 * "load more" history never buries an unread alert further down the list.
 */
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("notifications")
      .select(COLUMNS, { count: "exact" })
      // Unread (read_at is null) first, then most recent first.
      .order("read_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.category) query = query.eq("category", data.category);
    if (data.unreadOnly) query = query.is("read_at", null);

    const { data: rows, error, count } = await query;
    if (error) throw new Error("We could not load your notifications.");

    const page = rows ?? [];
    const total = count ?? page.length;
    return {
      rows: page,
      total,
      nextOffset: data.offset + page.length < total ? data.offset + page.length : null,
    };
  });

/** Unread totals overall and per category, for the badge and the filter tabs. */
export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("category")
      .is("read_at", null)
      .limit(1000);

    if (error) throw new Error("We could not load your notifications.");

    const rows = data ?? [];
    const byCategory: Record<string, number> = {};
    for (const row of rows) {
      byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
    }

    return { total: rows.length, byCategory };
  });

/** Mark one notification read. */
export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("read_at", null);

    if (error) throw new Error("We could not update that notification.");
    return { ok: true };
  });

/**
 * Mark every unread notification read, optionally limited to one category so
 * "mark all read" respects the filter the user is looking at.
 */
export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => categorySchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);

    if (data.category) query = query.eq("category", data.category);

    const { error } = await query;
    if (error) throw new Error("We could not update your notifications.");
    return { ok: true };
  });
