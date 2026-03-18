"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNotificationActionUrl } from "@/lib/notification-utils";
import { formatRelativeTime } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Notification } from "@/types";

interface NotificationBellProps {
  userId: string;
  initialNotifications: Notification[];
  initialUnreadCount: number;
}

const NOTIFICATION_LIMIT = 12;

function getNotificationSortDate(notification: Notification) {
  return notification.updated_at ?? notification.created_at;
}

function isNotificationVisible(notification: Notification) {
  return !notification.resolved_at || !notification.read;
}

function normalizeNotifications(notifications: Notification[]) {
  return notifications
    .filter(isNotificationVisible)
    .sort(
      (a, b) =>
        new Date(getNotificationSortDate(b)).getTime() -
        new Date(getNotificationSortDate(a)).getTime()
    )
    .slice(0, NOTIFICATION_LIMIT);
}

function mergeNotification(
  currentNotifications: Notification[],
  incomingNotification: Notification
) {
  return normalizeNotifications([
    incomingNotification,
    ...currentNotifications.filter(
      (notification) => notification.id !== incomingNotification.id
    ),
  ]);
}

export function NotificationBell({
  userId,
  initialNotifications,
  initialUnreadCount,
}: NotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(
    normalizeNotifications(initialNotifications)
  );
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    const supabase = createClient();

    async function refreshUnreadCount() {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false)
        .is("resolved_at", null);

      setUnreadCount(count ?? 0);
    }

    async function refreshNotifications() {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .or("resolved_at.is.null,read.eq.false")
        .order("updated_at", { ascending: false })
        .limit(NOTIFICATION_LIMIT);

      setNotifications(normalizeNotifications((data ?? []) as Notification[]));
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incomingNotification = payload.new as Notification;
          setNotifications((prev) =>
            mergeNotification(prev, incomingNotification)
          );
          void refreshUnreadCount();
          void refreshNotifications();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incomingNotification = payload.new as Notification;
          setNotifications((prev) =>
            mergeNotification(prev, incomingNotification)
          );
          void refreshUnreadCount();
          void refreshNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function markNotificationAsRead(notificationId: string) {
    const supabase = createClient();
    const now = new Date().toISOString();

    await supabase
      .from("notifications")
      .update({ read: true, read_at: now })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .eq("read", false);

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true, read_at: now }
          : notification
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function dismissNotification(notification: Notification) {
    const supabase = createClient();
    const now = new Date().toISOString();

    await supabase
      .from("notifications")
      .update({ read: true, read_at: now, resolved_at: now })
      .eq("id", notification.id)
      .eq("user_id", userId);

    setNotifications((prev) =>
      prev.filter((current) => current.id !== notification.id)
    );

    if (!notification.read && !notification.resolved_at) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }

  async function handleNotificationSelect(notification: Notification) {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    const actionUrl = getNotificationActionUrl(notification);
    if (actionUrl) {
      router.push(actionUrl);
      router.refresh();
    }
  }

  async function handleMarkAllAsRead() {
    if (unreadCount === 0) return;

    const supabase = createClient();
    const now = new Date().toISOString();

    await supabase
      .from("notifications")
      .update({ read: true, read_at: now })
      .eq("user_id", userId)
      .eq("read", false)
      .is("resolved_at", null);

    setUnreadCount(0);
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.resolved_at
          ? notification
          : { ...notification, read: true, read_at: now }
      )
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative rounded-full p-1.5 outline-none ring-ring/50 transition-colors hover:bg-muted focus-visible:ring-2"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[22rem] max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span>Notificaciones</span>
          {unreadCount > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleMarkAllAsRead();
              }}
            >
              Marcar todas
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No tienes notificaciones.
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="flex cursor-pointer flex-col items-start gap-2 py-3"
              onSelect={() => {
                void handleNotificationSelect(notification);
              }}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-start gap-2">
                    {!notification.read && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-destructive" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm ${
                          notification.read ? "" : "font-semibold"
                        }`}
                      >
                        {notification.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {notification.body}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(getNotificationSortDate(notification))}
                  </span>
                  <button
                    type="button"
                    aria-label="Descartar notificación"
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void dismissNotification(notification);
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
