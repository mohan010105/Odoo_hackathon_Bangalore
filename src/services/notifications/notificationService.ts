import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/notifications.functions";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  category: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationPage = {
  rows: NotificationRow[];
  total: number;
  /** Offset to request next, or null when the history is fully loaded. */
  nextOffset: number | null;
};

export type UnreadCounts = { total: number; byCategory: Record<string, number> };

export { NOTIFICATION_CATEGORIES };
export type { NotificationCategory };

/** In-app notification boundary, scoped to the signed-in user by RLS. */
export const notificationService = {
  /** One page of history, unread first. */
  async list(
    filters: {
      category?: NotificationCategory;
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<NotificationPage> {
    return (await listMyNotifications({
      data: {
        ...(filters.category ? { category: filters.category } : {}),
        unreadOnly: filters.unreadOnly ?? false,
        limit: filters.limit ?? 10,
        offset: filters.offset ?? 0,
      },
    })) as NotificationPage;
  },

  async unreadCount(): Promise<UnreadCounts> {
    return getUnreadNotificationCount({});
  },

  async markAsRead(id: string): Promise<void> {
    await markNotificationRead({ data: { id } });
  },

  async markAllAsRead(category?: NotificationCategory): Promise<void> {
    await markAllNotificationsRead({ data: category ? { category } : {} });
  },
};
