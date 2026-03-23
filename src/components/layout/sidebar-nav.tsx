"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
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
  const workspaceItems = [
    { href: "/shifts", label: "Turnos disponibles", icon: CalendarDays },
    { href: "/shifts/my", label: "Mis turnos", icon: CalendarCheck },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/exchanges", label: "Intercambios", icon: Repeat },
  ];
  const supportItems = [
    ...(hasAdminPanelAccess(role)
      ? [
          { href: "/admin/exchanges", label: "Aprobaciones", icon: ClipboardCheck },
          { href: "/admin/validations", label: "Validaciones", icon: ShieldCheck },
        ]
      : []),
    { href: "/profile", label: "Perfil", icon: User },
  ];

  const renderItem = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: typeof CalendarDays;
  }) => {
    const isActive =
      href === "/shifts" ? pathname === "/shifts" : pathname.startsWith(href);

    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
      >
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            isActive ? "bg-primary/12 text-primary" : "bg-background text-muted-foreground"
          )}
        >
          <Icon className="size-4 shrink-0" />
        </div>
        <span className="min-w-0 truncate">{label}</span>
      </Link>
    );
  };

  return (
    <nav className="sticky top-20 flex flex-col gap-6 p-4">
      <div className="space-y-2">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Trabajo
        </p>
        <div className="space-y-1">{workspaceItems.map(renderItem)}</div>
      </div>

      <div className="space-y-2">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Cuenta
        </p>
        <div className="space-y-1">{supportItems.map(renderItem)}</div>
      </div>
    </nav>
  );
}
