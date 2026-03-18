"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarCheck,
  MessageSquare,
  Repeat,
  ShieldCheck,
  User,
} from "lucide-react";
import { hasAdminPanelAccess } from "@/lib/user-roles";
import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  role: UserRole;
}

export function SidebarNav({ role }: SidebarNavProps) {
  const pathname = usePathname();
  const navItems = [
    { href: "/shifts", label: "Turnos", icon: CalendarDays },
    { href: "/shifts/my", label: "Mis turnos", icon: CalendarCheck },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/exchanges", label: "Intercambios", icon: Repeat },
    ...(hasAdminPanelAccess(role)
      ? [{ href: "/admin/validations", label: "Admin", icon: ShieldCheck }]
      : []),
    { href: "/profile", label: "Perfil", icon: User },
  ];

  return (
    <nav className="flex flex-col gap-1 p-4">
      {navItems.map((item) => {
        const isActive =
          item.href === "/shifts"
            ? pathname === "/shifts"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
