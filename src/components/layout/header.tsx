"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { User, LogOut, CalendarDays, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";
import type { UserProfile, Notification } from "@/types";

interface HeaderProps {
  user: UserProfile | null;
  initialNotifications: Notification[];
  initialUnreadCount: number;
}

const mobileNavItems = [
  { href: "/shifts", label: "Turnos", icon: CalendarDays },
  { href: "/shifts/my", label: "Mis turnos", icon: CalendarDays },
  { href: "/exchanges", label: "Intercambios", icon: Repeat },
  { href: "/profile", label: "Perfil", icon: User },
];

export function Header({
  user,
  initialNotifications,
  initialUnreadCount,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?"
    : "?";

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      {/* Main row */}
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
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none ring-ring/50 focus-visible:ring-2 focus-visible:ring-offset-2">
              <Avatar className="size-8 cursor-pointer">
                <AvatarImage src={user?.avatar_url} alt={user?.full_name} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
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
        </div>
      </div>

      {/* Mobile nav — visible only when sidebar is hidden */}
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
