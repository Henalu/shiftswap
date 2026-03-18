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
  CalendarDays,
  LogOut,
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

// Loaded client-side only to avoid Radix hydration mismatches in dev.
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
    { href: "/shifts/my", label: "Mis turnos", icon: CalendarDays },
    { href: "/exchanges", label: "Intercambios", icon: Repeat },
    ...(hasAdminPanelAccess(role)
      ? [{ href: "/admin/validations", label: "Admin", icon: ShieldCheck }]
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
    <Avatar className="size-8">
      <AvatarImage src={user?.avatar_url} alt={user?.full_name} />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <Link
          href="/shifts"
          className="flex items-center gap-2 font-semibold text-foreground"
        >
          ShiftSwap
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
              <DropdownMenuTrigger className="rounded-full outline-none ring-ring/50 focus-visible:ring-2 focus-visible:ring-offset-2">
                {avatar}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-medium">{user?.full_name ?? "Usuario"}</p>
                  <p className="text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <User className="mr-2 size-4" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleLogout}
                  className="cursor-pointer"
                >
                  <LogOut className="mr-2 size-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              aria-label="Menú de usuario"
              disabled
              className="rounded-full outline-none ring-ring/50"
            >
              {avatar}
            </button>
          )}
        </div>
      </div>

      <nav className="flex overflow-x-auto border-t px-2 md:hidden">
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
                "flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
