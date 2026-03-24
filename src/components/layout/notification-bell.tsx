"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock3,
  LucideIcon,
  MessageSquareMore,
  X,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNotificationActionUrl } from "@/lib/notification-utils";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Notification, NotificationType } from "@/types";

interface NotificationBellProps {
  userId: string;
  initialNotifications: Notification[];
  initialUnreadCount: number;
}

interface NotificationAppearance {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
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

function getNotificationAppearance(type: NotificationType): NotificationAppearance {
  switch (type) {
    case "new_message":
      return {
        label: "Chat",
        icon: MessageSquareMore,
        iconClassName:
          "border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      };
    case "exchange_department_approved":
    case "request_accepted":
    case "exchange_confirmed":
    case "exchange_signed":
    case "account_approved":
      return {
        label: "Aprobado",
        icon: CheckCircle2,
        iconClassName:
          "border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      };
    case "request_rejected":
    case "shift_cancelled":
    case "exchange_cancelled":
    case "exchange_department_rejected":
    case "account_rejected":
      return {
        label: "Estado",
        icon: XCircle,
        iconClassName:
          "border-rose-500/15 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      };
    case "shift_request":
    case "exchange_pending_approval":
    case "exchange_cancellation_requested":
    case "exchange_cancellation_rejected":
      return {
        label: "Pendiente",
        icon: Clock3,
        iconClassName:
          "border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case "exchange_document_added":
      return {
        label: "Documento",
        icon: BellRing,
        iconClassName:
          "border-violet-500/15 bg-violet-500/10 text-violet-700 dark:text-violet-300",
      };
    default:
      return {
        label: "Aviso",
        icon: BellRing,
        iconClassName:
          "border-violet-500/15 bg-violet-500/10 text-violet-700 dark:text-violet-300",
      };
  }
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
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  useEffect(() => {
    if (!mobileOpen) return;

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) setMobileOpen(false);
    }

    mediaQuery.addEventListener("change", closeOnDesktop);
    return () => mediaQuery.removeEventListener("change", closeOnDesktop);
  }, [mobileOpen]);

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

  async function handleNotificationSelect(
    notification: Notification,
    surface: "desktop" | "mobile"
  ) {
    if (surface === "desktop") {
      setDesktopOpen(false);
    } else {
      setMobileOpen(false);
    }

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

  function renderNotificationList(surface: "desktop" | "mobile") {
    if (notifications.length === 0) {
      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center text-center",
            surface === "desktop" ? "px-5 py-10" : "px-4 py-14"
          )}
        >
          <div className="flex size-14 items-center justify-center rounded-[1.4rem] border border-border/70 bg-card/90 text-muted-foreground">
            <BellRing className="size-6" />
          </div>
          <p className="mt-4 text-sm font-semibold tracking-[-0.02em] text-foreground">
            Todo al dia
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            No tienes notificaciones pendientes ahora mismo.
          </p>
        </div>
      );
    }

    return (
      <div className={cn("space-y-2", surface === "desktop" ? "p-2" : "space-y-3")}>
        {notifications.map((notification) => {
          const appearance = getNotificationAppearance(notification.type);
          const timestamp = formatRelativeTime(getNotificationSortDate(notification));

          return (
            <div
              key={notification.id}
              className={cn(
                "rounded-[1.6rem] border transition-[border-color,background-color,box-shadow] duration-200 ease-out",
                surface === "desktop"
                  ? notification.read
                    ? "border-border/70 bg-card/92 hover:border-border hover:bg-card"
                    : "border-primary/15 bg-primary/[0.05] shadow-[0_18px_32px_-30px_rgba(37,99,235,0.35)] hover:border-primary/20 hover:bg-primary/[0.07]"
                  : notification.read
                    ? "border-border/70 bg-card/96 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.2)]"
                    : "border-primary/15 bg-primary/[0.05] shadow-[0_20px_36px_-30px_rgba(37,99,235,0.34)]"
              )}
            >
              <div className="flex items-start gap-3 px-3.5 py-3.5">
                <div
                  className={cn(
                    "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl border",
                    appearance.iconClassName
                  )}
                >
                  <appearance.icon className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-2xl text-left outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
                      onClick={() => {
                        void handleNotificationSelect(notification, surface);
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary-foreground">
                          {appearance.label}
                        </span>
                        {!notification.read && (
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                            Sin leer
                          </span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {timestamp}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-3 text-sm leading-5 tracking-[-0.02em]",
                          notification.read ? "font-medium" : "font-semibold"
                        )}
                      >
                        {notification.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {notification.body}
                      </p>
                    </button>

                    <button
                      type="button"
                      aria-label="Descartar notificacion"
                      className="flex size-9 shrink-0 items-center justify-center rounded-2xl text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/10"
                      onClick={() => {
                        void dismissNotification(notification);
                      }}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
            className="relative flex size-10 items-center justify-center rounded-2xl border border-border/70 bg-background/90 p-2 shadow-sm transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/10 md:hidden"
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-foreground shadow-sm">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-slate-950/18 backdrop-blur-[3px] md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:transition-none" />
          <DialogPrimitive.Content className="fixed inset-0 z-[61] flex h-[100dvh] flex-col overflow-hidden bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_94%,white)_0%,var(--background)_18rem)] text-foreground outline-none md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-3 data-[state=open]:slide-in-from-top-3 motion-reduce:transition-none">
            <DialogPrimitive.Title className="sr-only">
              Notificaciones
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Panel de notificaciones con tus cambios, mensajes y estados recientes.
            </DialogPrimitive.Description>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,oklch(0.88_0.07_255_/_0.22),transparent_72%)]"
            />

            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between gap-3 px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/90 px-3.5 py-2.5 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.3)]">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Bell className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-[-0.02em]">
                      Notificaciones
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {unreadCount > 0
                        ? `${unreadCount} pendientes por revisar`
                        : "Todo tu inbox esta al dia"}
                    </p>
                  </div>
                </div>

                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    aria-label="Cerrar notificaciones"
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/90 outline-none transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/10"
                  >
                    <X className="size-5" />
                  </button>
                </DialogPrimitive.Close>
              </div>

              <div className="px-4 pb-4">
                <div className="rounded-[1.75rem] border border-border/70 bg-card/90 px-4 py-4 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.25)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold tracking-[-0.025em] text-foreground">
                        Mantente al dia con tus turnos e intercambios
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Revisa mensajes, decisiones y cambios de estado sin perder el contexto.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                      {notifications.length}
                    </div>
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.06] px-4 py-2.5 text-sm font-semibold text-primary outline-none transition-colors hover:bg-primary/[0.1] focus-visible:ring-4 focus-visible:ring-primary/10"
                      onClick={() => {
                        void handleMarkAllAsRead();
                      }}
                    >
                      Marcar todas como leidas
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                {renderNotificationList("mobile")}
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DropdownMenu open={desktopOpen} onOpenChange={setDesktopOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
            className="relative hidden size-10 items-center justify-center rounded-2xl border border-border/70 bg-background/90 p-2 shadow-sm transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/10 md:flex"
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-foreground shadow-sm">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="hidden w-[24rem] rounded-[1.6rem] border-border/80 bg-popover/98 p-0 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.28)] md:block"
        >
          <div className="border-b border-border/70 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold tracking-[-0.02em] text-foreground">
                  Notificaciones
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Mantente al dia con tus turnos e intercambios.
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-secondary"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleMarkAllAsRead();
                  }}
                >
                  Marcar todas
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[min(70vh,32rem)] overflow-y-auto p-2">
            {renderNotificationList("desktop")}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
