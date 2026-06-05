"use client";

import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  CalendarCog,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  Gauge,
  House,
  MessageSquare,
  Repeat,
  ShieldCheck,
  User,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { hasAdminPanelAccess, isSuperAdmin } from "@/lib/user-roles";
import type { UserRole } from "@/types";

export interface NavigationItem {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  tour?: string;
}

export const PRIMARY_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    href: "/home",
    label: "Inicio",
    description: "Resumen rapido de tu dia y acciones pendientes.",
    icon: House,
    tour: "nav-home",
  },
  {
    href: "/shifts",
    label: "Tablon",
    description: "Explora y filtra los turnos abiertos.",
    icon: CalendarDays,
    tour: "nav-shifts",
  },
  {
    href: "/shifts/my",
    label: "Mis turnos",
    description: "Gestiona publicaciones y solicitudes recibidas.",
    icon: CalendarCheck,
    tour: "nav-my-shifts",
  },
  {
    href: "/calendar",
    label: "Calendario",
    description: "Consulta tu horario mensual y vacaciones.",
    icon: CalendarRange,
    tour: "nav-calendar",
  },
  {
    href: "/chat",
    label: "Chat",
    description: "Habla con otros companeros sobre cada cambio.",
    icon: MessageSquare,
    tour: "nav-chat",
  },
  {
    href: "/exchanges",
    label: "Cambios",
    description: "Revisa acuerdos, firmas y estado del expediente.",
    icon: Repeat,
    tour: "nav-exchanges",
  },
  {
    href: "/hours-bank",
    label: "Bolsa horas",
    description: "Consulta las horas pendientes con otros companeros.",
    icon: WalletCards,
    tour: "nav-hours-bank",
  },
];

/** Mobile bottom nav: keeps the five most-used destinations one tap away. */
export const MOBILE_NAVIGATION_ITEMS: NavigationItem[] = [
  PRIMARY_NAVIGATION_ITEMS[0], // Inicio
  PRIMARY_NAVIGATION_ITEMS[1], // Tablon
  { ...PRIMARY_NAVIGATION_ITEMS[3], label: "Calend." }, // Calendario
  PRIMARY_NAVIGATION_ITEMS[4], // Chat
  PRIMARY_NAVIGATION_ITEMS[5], // Cambios
];

export const ACCOUNT_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    href: "/profile",
    label: "Mi perfil",
    description: "Consulta tus datos y preferencias basicas.",
    icon: User,
    tour: "nav-profile",
  },
  {
    href: "/help",
    label: "Ayuda",
    description: "Aprende como funciona la app y resuelve dudas.",
    icon: CircleHelp,
    tour: "nav-help",
  },
  {
    href: "/billing",
    label: "Suscripcion",
    description: "Consulta el estado de acceso y gestiona tu plan.",
    icon: CreditCard,
  },
];

export function getAdminNavigationItems(role: UserRole): NavigationItem[] {
  if (!hasAdminPanelAccess(role)) {
    return [];
  }

  const adminItems: NavigationItem[] = [
    {
      href: "/admin/exchanges",
      label: "Cambios equipo",
      description: "Consulta intercambios aceptados por el equipo.",
      icon: ClipboardCheck,
      tour: "nav-admin",
    },
    {
      href: "/admin/validations",
      label: "Validaciones",
      description: "Revisa altas y accesos antes de aprobarlos.",
      icon: ShieldCheck,
    },
    {
      href: "/admin/schedule-config",
      label: "Calendarios",
      description: "Configura tipo de jornada y grupos de rotacion.",
      icon: CalendarCog,
    },
  ];

  if (isSuperAdmin(role)) {
    adminItems.push(
      {
        href: "/admin/platform",
        label: "Plataforma",
        description: "Consulta organizaciones, billing y metricas globales.",
        icon: Gauge,
      },
      {
        href: "/admin/users",
        label: "Usuarios y roles",
        description: "Gestiona permisos y alcance de cada cuenta.",
        icon: Users,
      }
    );
  }

  return adminItems;
}

export function isNavigationItemActive(pathname: string, href: string) {
  switch (href) {
    case "/home":
      return pathname === "/home";
    case "/shifts":
      return (
        pathname === "/shifts" ||
        (/^\/shifts\/[^/]+$/.test(pathname) &&
          !pathname.startsWith("/shifts/my") &&
          !pathname.startsWith("/shifts/new"))
      );
    case "/shifts/my":
      return pathname.startsWith("/shifts/my") || pathname.startsWith("/shifts/new");
    case "/calendar":
      return pathname === "/calendar" || pathname.startsWith("/calendar/");
    case "/chat":
      return pathname === "/chat" || pathname.startsWith("/chat/");
    case "/exchanges":
      return pathname === "/exchanges" || pathname.startsWith("/exchanges/");
    case "/hours-bank":
      return pathname === "/hours-bank" || pathname.startsWith("/hours-bank/");
    case "/profile":
      return pathname === "/profile" || pathname.startsWith("/profile/");
    case "/help":
      return pathname === "/help" || pathname.startsWith("/help/");
    case "/billing":
      return pathname === "/billing" || pathname.startsWith("/billing/");
    case "/admin/exchanges":
      return pathname === "/admin" || pathname.startsWith("/admin/exchanges");
    case "/admin/validations":
      return pathname.startsWith("/admin/validations");
    case "/admin/users":
      return pathname.startsWith("/admin/users");
    case "/admin/platform":
      return pathname.startsWith("/admin/platform");
    case "/admin/schedule-config":
      return pathname.startsWith("/admin/schedule-config");
    default:
      return pathname === href || pathname.startsWith(`${href}/`);
  }
}
