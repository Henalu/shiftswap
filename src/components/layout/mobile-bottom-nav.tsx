"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  isNavigationItemActive,
  PRIMARY_NAVIGATION_ITEMS,
} from "@/components/layout/navigation-items";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 md:hidden">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(241,245,249,0.95)_42%,rgba(241,245,249,1)_100%)]"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-[calc(env(safe-area-inset-bottom)+0.6rem)]">
        <nav
          aria-label="Navegacion principal"
          className="pointer-events-auto grid grid-cols-4 gap-1 rounded-[1.75rem] border border-border/70 bg-background/94 p-2 shadow-[0_-10px_30px_-24px_rgba(15,23,42,0.28),0_18px_38px_-28px_rgba(15,23,42,0.24)] backdrop-blur supports-[backdrop-filter]:bg-background/88"
        >
          {PRIMARY_NAVIGATION_ITEMS.map((item) => {
            const isActive = isNavigationItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-[1.3rem] px-2 py-2 text-center outline-none transition-[background-color,color,transform] duration-200 ease-out focus-visible:ring-4 focus-visible:ring-primary/10 motion-reduce:transition-none",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/85 hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-2xl transition-colors duration-200",
                    isActive
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground group-hover:bg-card group-hover:text-foreground"
                  )}
                >
                  <Icon className="size-4.5 shrink-0" />
                </div>
                <span className="max-w-full truncate text-[11px] font-semibold leading-none tracking-[-0.01em]">
                  {item.mobileLabel ?? item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
