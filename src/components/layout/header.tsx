"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  LogOut,
  MessageSquare,
  Repeat,
  ShieldCheck,
  User,
} from "lucide-react";
import { hasAdminPanelAccess } from "@/lib/user-roles";
import type { Notification, UserProfile, UserRole } from "@/types";

function subscribeToClientRender() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

const NotificationBell = dynamic(
  () => import("./notification-bell").then((m) => ({ default: m.NotificationBell })),
  { ssr: false }
);

interface HeaderProps {
  user: UserProfile | null;
  initialNotifications: Notification[];
  initialUnreadCount: number;
  role: UserRole;
}

export function Header({
  user,
  initialNotifications,
  initialUnreadCount,
  role,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isUserMenuMounted = useSyncExternalStore(
    subscribeToClientRender,
    getClientSnapshot,
    getServerSnapshot
  );

  const mobileNavItems = [
    { href: "/shifts", label: "Turnos", icon: CalendarDays },
    { href: "/shifts/my", label: "Mis turnos", icon: CalendarCheck },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/exchanges", label: "Intercambios", icon: Repeat },
    ...(hasAdminPanelAccess(role)
      ? [
          { href: "/admin/exchanges", label: "Aprobaciones", icon: ClipboardCheck },
          { href: "/admin/validations", label: "Validaciones", icon: ShieldCheck },
        ]
      : []),
    { href: "/profile", label: "Perfil", icon: User },
  ];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((name) => name[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?"
    : "?";

  const avatar = (
    <Avatar className="size-9 rounded-xl">
      <AvatarImage src={user?.avatar_url} alt={user?.full_name} />
      <AvatarFallback className="rounded-xl bg-secondary text-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/88">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/shifts" className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Repeat className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">
              ShiftSwap
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Intercambio de turnos
            </p>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {user && (
            <NotificationBell
              userId={user.id}
              initialNotifications={initialNotifications}
              initialUnreadCount={initialUnreadCount}
            />
          )}

          {isUserMenuMounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-2xl border border-border/70 bg-background/90 p-1 shadow-sm outline-none transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/10"
                aria-label="Abrir menu de usuario"
              >
                {avatar}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl">
                <DropdownMenuLabel className="space-y-1">
                  <p className="font-semibold tracking-[-0.02em]">
                    {user?.full_name ?? "Usuario"}
                  </p>
                  <p className="text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <User className="mr-2 size-4" />
                  Mi perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleLogout}
                  className="cursor-pointer"
                >
                  <LogOut className="mr-2 size-4" />
                  Cerrar sesion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              aria-label="Menu de usuario"
              disabled
              className="rounded-2xl border border-border/70 bg-background/90 p-1 shadow-sm"
            >
              {avatar}
            </button>
          )}
        </div>
      </div>

      <nav className="border-t border-border/70 md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 py-2">
          {mobileNavItems.map((item) => {
            const isActive =
              item.href === "/shifts"
                ? pathname === "/shifts"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
