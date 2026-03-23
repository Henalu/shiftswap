"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNotificationActionUrl } from "@/lib/notification-utils";
import { cn, formatRelativeTime } from "@/lib/utils";
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
          setNotifications((prev) => mergeNotification(prev, incomingNotification));
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
          setNotifications((prev) => mergeNotification(prev, incomingNotification));
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
        className="relative rounded-2xl border border-border/70 bg-background/90 p-2 shadow-sm transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/10"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-foreground shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[23rem] max-w-[calc(100vw-1.5rem)] rounded-2xl"
      >
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold tracking-[-0.02em]">Notificaciones</p>
            <p className="text-xs font-normal text-muted-foreground">
              Mantente al dia con tus turnos e intercambios
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-secondary"
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
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              Todo al dia
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              No tienes notificaciones pendientes.
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="flex cursor-pointer flex-col items-start gap-3 rounded-xl px-3 py-3"
              onSelect={() => {
                void handleNotificationSelect(notification);
              }}
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-start gap-2">
                    {!notification.read && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className="min-w-0 space-y-1">
                      <p
                        className={cn(
                          "truncate text-sm",
                          notification.read ? "font-medium" : "font-semibold"
                        )}
                      >
                        {notification.title}
                      </p>
                      <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                        {notification.body}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <span className="pt-0.5 text-xs text-muted-foreground">
                    {formatRelativeTime(getNotificationSortDate(notification))}
                  </span>
                  <button
                    type="button"
                    aria-label="Descartar notificacion"
                    className="flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void dismissNotification(notification);
                    }}
                  >
                    <X className="size-4" />
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
