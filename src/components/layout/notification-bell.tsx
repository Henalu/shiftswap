"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNotificationActionUrl } from "@/lib/notification-utils";
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

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;

  return `hace ${Math.floor(hours / 24)}d`;
}

function mergeNotification(
  currentNotifications: Notification[],
  incomingNotification: Notification
) {
  const nextNotifications = [
    incomingNotification,
    ...currentNotifications.filter(
      (notification) => notification.id !== incomingNotification.id
    ),
  ];

  return nextNotifications
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 10);
}

export function NotificationBell({
  userId,
  initialNotifications,
  initialUnreadCount,
}: NotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] =
    useState<Notification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    const supabase = createClient();

    async function refreshUnreadCount() {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);

      setUnreadCount(count ?? 0);
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

          if (!incomingNotification.read) {
            setUnreadCount((prev) => prev + 1);
          }
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
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function markNotificationAsRead(notificationId: string) {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .eq("read", false);

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function handleNotificationSelect(notification: Notification) {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    const actionUrl = getNotificationActionUrl(notification);
    if (actionUrl) {
      router.push(actionUrl);
    }
  }

  async function handleMarkAllAsRead() {
    if (unreadCount === 0) return;

    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    setUnreadCount(0);
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, read: true }))
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
      <DropdownMenuContent align="end" className="w-96">
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
              className="flex cursor-pointer flex-col items-start gap-1 py-3"
              onSelect={() => {
                void handleNotificationSelect(notification);
              }}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm ${
                      notification.read ? "" : "font-semibold"
                    }`}
                  >
                    {notification.title}
                  </p>
                  <div className="mt-1 flex items-start gap-2">
                    {!notification.read && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-destructive" />
                    )}
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {notification.body}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(notification.created_at)}
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
