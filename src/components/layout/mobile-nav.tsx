"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GuidedHelpLaunchButton } from "@/components/layout/guided-help-tour";
import { buttonVariants } from "@/components/ui/button";
import { ChevronRight, Lightbulb, LogOut, ShieldCheck, X } from "lucide-react";
import { USER_ROLE_LABELS } from "@/lib/user-roles";
import { cn } from "@/lib/utils";
import type { UserProfile, UserRole } from "@/types";
import { createClient } from "@/lib/supabase/client";
import {
  ACCOUNT_NAVIGATION_ITEMS,
  getAdminNavigationItems,
  isNavigationItemActive,
  type NavigationItem,
} from "@/components/layout/navigation-items";

interface MobileNavProps {
  canAccessPlatformConsole?: boolean;
  user: UserProfile | null;
  role: UserRole;
}

export function MobileNav({
  canAccessPlatformConsole = false,
  user,
  role,
}: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const adminItems = getAdminNavigationItems(role);

  useEffect(() => {
    if (!isOpen) return;

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) setIsOpen(false);
    }

    mediaQuery.addEventListener("change", closeOnDesktop);
    return () => mediaQuery.removeEventListener("change", closeOnDesktop);
  }, [isOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsOpen(false);
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

  const renderItem = (item: NavigationItem) => {
    const active = isNavigationItemActive(pathname, item.href);
    const Icon = item.icon;

    return (
      <DialogPrimitive.Close asChild key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          data-tour={item.tour}
          className={cn(
            "group flex items-center gap-4 rounded-[1.6rem] border px-4 py-3.5 text-left outline-none transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out focus-visible:ring-4 focus-visible:ring-primary/10 motion-reduce:transition-none",
            active
              ? "border-primary/15 bg-primary/[0.08] text-foreground shadow-[0_18px_35px_-28px_rgba(37,99,235,0.35)]"
              : "border-transparent bg-transparent text-foreground hover:border-border/70 hover:bg-card/90"
          )}
        >
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl border transition-colors duration-200",
              active
                ? "border-primary/12 bg-primary/12 text-primary"
                : "border-border/70 bg-card text-muted-foreground group-hover:text-foreground"
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-semibold tracking-[-0.02em]">
                {item.label}
              </span>
              {active && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  Actual
                </span>
              )}
            </div>
            {item.description && (
              <p className="truncate text-sm text-muted-foreground">
                {item.description}
              </p>
            )}
          </div>
          <ChevronRight
            className={cn(
              "size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
              active
                ? "text-primary"
                : "text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground"
            )}
          />
        </Link>
      </DialogPrimitive.Close>
    );
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={isOpen ? "Cerrar cuenta" : "Abrir cuenta"}
          aria-expanded={isOpen}
          className="rounded-2xl border border-border/70 bg-background/90 p-1 shadow-sm outline-none transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/10 md:hidden"
        >
          <Avatar className="size-8 rounded-xl">
            <AvatarImage
              src={user?.avatar_url ?? undefined}
              alt={user?.full_name ?? undefined}
            />
            <AvatarFallback className="rounded-xl bg-secondary text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-slate-950/18 backdrop-blur-[3px] md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:transition-none" />
        <DialogPrimitive.Content className="fixed inset-0 z-[61] flex h-[100dvh] flex-col overflow-hidden bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_94%,white)_0%,var(--background)_18rem)] text-foreground outline-none md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-3 data-[state=open]:slide-in-from-top-3 motion-reduce:transition-none">
          <DialogPrimitive.Title className="sr-only">
            Cuenta y opciones secundarias
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Accede a tu perfil, opciones de administracion y cierre de sesion.
          </DialogPrimitive.Description>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,oklch(0.88_0.07_255_/_0.22),transparent_72%)]"
          />

          <div className="relative flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
              <div className="space-y-1">
                <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">
                  Cuenta
                </p>
                <p className="text-sm text-muted-foreground">
                  Perfil, accesos secundarios y administracion.
                </p>
              </div>

              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="Cerrar cuenta"
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/90 outline-none transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/10"
                >
                  <X className="size-5" />
                </button>
              </DialogPrimitive.Close>
            </div>

            <div className="px-4 pb-4">
              <div className="rounded-[1.75rem] border border-border/70 bg-card/90 px-4 py-4 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.25)]">
                <div className="flex items-center gap-3">
                  <Avatar className="size-14 rounded-[1.35rem]">
                    <AvatarImage
                      src={user?.avatar_url ?? undefined}
                      alt={user?.full_name ?? undefined}
                    />
                    <AvatarFallback className="rounded-[1.35rem] bg-secondary font-semibold text-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold tracking-[-0.025em]">
                      {user?.full_name ?? "Usuario"}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <div className="mt-4 inline-flex rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                  {USER_ROLE_LABELS[role]}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <nav className="space-y-6">
                {adminItems.length > 0 && (
                  <section className="space-y-2">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Administracion
                    </p>
                    <div className="space-y-1.5">{adminItems.map(renderItem)}</div>
                  </section>
                )}

                <section
                  className={cn(
                    "space-y-2",
                    adminItems.length > 0 ? "border-t border-border/70 pt-6" : ""
                  )}
                >
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Cuenta
                  </p>
                  <div className="space-y-1.5">
                    {ACCOUNT_NAVIGATION_ITEMS.map(renderItem)}
                    <GuidedHelpLaunchButton
                      className="min-h-11 w-full justify-start rounded-[1.6rem] py-3.5"
                      label="Guia inicial"
                      onLaunch={() => setIsOpen(false)}
                    />
                    <DialogPrimitive.Close asChild>
                      <Link
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "min-h-11 w-full justify-start rounded-[1.6rem] py-3.5"
                        )}
                        href="/help#sugerencias"
                      >
                        <Lightbulb aria-hidden="true" />
                        Sugerencias
                      </Link>
                    </DialogPrimitive.Close>
                  </div>
                </section>

                {canAccessPlatformConsole ? (
                  <section className="space-y-2 border-t border-border/70 pt-6">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Plataforma
                    </p>
                    <DialogPrimitive.Close asChild>
                      <Link
                        className="group flex items-center gap-4 rounded-[1.6rem] border border-primary/15 bg-primary/[0.08] px-4 py-3.5 text-left outline-none transition-colors hover:bg-primary/[0.12] focus-visible:ring-4 focus-visible:ring-primary/10"
                        href="/console"
                      >
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/12 bg-primary/12 text-primary">
                          <ShieldCheck className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="truncate text-[15px] font-semibold tracking-[-0.02em]">
                            Console
                          </span>
                          <p className="truncate text-sm text-muted-foreground">
                            Panel separado de plataforma.
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-primary" />
                      </Link>
                    </DialogPrimitive.Close>
                  </section>
                ) : null}
              </nav>
            </div>

            <div className="border-t border-border/70 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex min-h-11 w-full items-center gap-3.5 rounded-[1.6rem] border border-destructive/15 bg-destructive/[0.04] px-4 py-3.5 text-[15px] font-semibold text-destructive outline-none transition-[background-color,border-color] duration-200 ease-out hover:bg-destructive/[0.08] focus-visible:ring-4 focus-visible:ring-destructive/20 motion-reduce:transition-none"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <LogOut className="size-5" />
                </div>
                <span className="flex-1 text-left">Cerrar sesion</span>
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
