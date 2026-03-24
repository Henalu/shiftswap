"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  LogOut,
  LucideIcon,
  Menu,
  MessageSquare,
  Repeat,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { hasAdminPanelAccess } from "@/lib/user-roles";
import { cn } from "@/lib/utils";
import type { UserProfile, UserRole } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface MobileNavProps {
  user: UserProfile | null;
  role: UserRole;
}

interface MobileNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export function MobileNav({ user, role }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) setIsOpen(false);
    }
    mediaQuery.addEventListener("change", closeOnDesktop);
    return () => mediaQuery.removeEventListener("change", closeOnDesktop);
  }, [isOpen]);

  const workItems: MobileNavItem[] = [
    {
      href: "/shifts",
      label: "Turnos disponibles",
      description: "Explora y filtra los turnos abiertos.",
      icon: CalendarDays,
    },
    {
      href: "/shifts/my",
      label: "Mis turnos",
      description: "Gestiona publicaciones y solicitudes recibidas.",
      icon: CalendarCheck,
    },
    {
      href: "/chat",
      label: "Chat",
      description: "Habla con otros compañeros sobre cada cambio.",
      icon: MessageSquare,
    },
    {
      href: "/exchanges",
      label: "Intercambios",
      description: "Revisa acuerdos, firmas y estado del expediente.",
      icon: Repeat,
    },
  ];

  const adminItems: MobileNavItem[] = hasAdminPanelAccess(role)
    ? [
        {
          href: "/admin/exchanges",
          label: "Aprobaciones",
          description: "Resuelve expedientes pendientes del equipo.",
          icon: ClipboardCheck,
        },
        {
          href: "/admin/validations",
          label: "Validaciones",
          description: "Revisa altas y accesos antes de aprobarlos.",
          icon: ShieldCheck,
        },
      ]
    : [];
  const accountItems: MobileNavItem[] = [
    {
      href: "/profile",
      label: "Mi perfil",
      description: "Consulta tus datos y preferencias básicas.",
      icon: User,
    },
  ];

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
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?"
    : "?";

  const isActive = (href: string) =>
    href === "/shifts" ? pathname === "/shifts" : pathname.startsWith(href);

  const renderItem = (item: {
    href: string;
    label: string;
    description: string;
    icon: LucideIcon;
  }) => {
    const active = isActive(item.href);
    return (
      <DialogPrimitive.Close asChild key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
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
            <item.icon className="size-5" />
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
            <p className="truncate text-sm text-muted-foreground">
              {item.description}
            </p>
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
          aria-label={isOpen ? "Cerrar menu" : "Abrir menu de navegacion"}
          aria-expanded={isOpen}
          className="flex size-10 items-center justify-center rounded-2xl border border-border/70 bg-background/90 shadow-sm outline-none transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/10 md:hidden"
        >
          <Menu className="size-5" />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-slate-950/18 backdrop-blur-[3px] md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:transition-none" />
        <DialogPrimitive.Content className="fixed inset-0 z-[61] flex h-[100dvh] flex-col overflow-hidden bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_94%,white)_0%,var(--background)_18rem)] text-foreground outline-none md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-3 data-[state=open]:slide-in-from-top-3 motion-reduce:transition-none">
          <DialogPrimitive.Title className="sr-only">
            Menu de navegacion
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Accede rapidamente a turnos, conversaciones, intercambios y perfil.
          </DialogPrimitive.Description>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,oklch(0.88_0.07_255_/_0.22),transparent_72%)]"
          />

          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
              <DialogPrimitive.Close asChild>
                <Link
                  href="/shifts"
                  className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/90 px-3.5 py-2.5 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.3)] transition-colors hover:bg-card"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Repeat className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-[-0.02em]">
                      ShiftSwap
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Intercambio de turnos
                    </p>
                  </div>
                </Link>
              </DialogPrimitive.Close>

              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="Cerrar menu"
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/90 outline-none transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-primary/10"
                >
                  <X className="size-5" />
                </button>
              </DialogPrimitive.Close>
            </div>

            <div className="px-4 pb-4">
              <div className="flex items-center gap-3 rounded-[1.75rem] border border-border/70 bg-card/90 px-4 py-4 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.25)]">
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
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <nav className="space-y-6">
                <section className="space-y-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Trabajo
                  </p>
                  <div className="space-y-1.5">{workItems.map(renderItem)}</div>
                </section>

                {adminItems.length > 0 && (
                  <section className="space-y-2 border-t border-border/70 pt-6">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Administracion
                    </p>
                    <div className="space-y-1.5">{adminItems.map(renderItem)}</div>
                  </section>
                )}

                <section className="space-y-2 border-t border-border/70 pt-6">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Cuenta
                  </p>
                  <div className="space-y-1.5">{accountItems.map(renderItem)}</div>
                </section>
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
