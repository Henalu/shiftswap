"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_NAVIGATION_ITEMS,
  getAdminNavigationItems,
  isNavigationItemActive,
  PRIMARY_NAVIGATION_ITEMS,
} from "@/components/layout/navigation-items";

interface SidebarNavProps {
  role: UserRole;
}

export function SidebarNav({ role }: SidebarNavProps) {
  const pathname = usePathname();
  const adminItems = getAdminNavigationItems(role);

  const renderItem = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: (typeof PRIMARY_NAVIGATION_ITEMS)[number]["icon"];
  }) => {
    const isActive = isNavigationItemActive(pathname, href);

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
        <div className="space-y-1">{PRIMARY_NAVIGATION_ITEMS.map(renderItem)}</div>
      </div>

      {adminItems.length > 0 && (
        <div className="space-y-2">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Administracion
          </p>
          <div className="space-y-1">{adminItems.map(renderItem)}</div>
        </div>
      )}

      <div className="space-y-2">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Cuenta
        </p>
        <div className="space-y-1">{ACCOUNT_NAVIGATION_ITEMS.map(renderItem)}</div>
      </div>
    </nav>
  );
}
