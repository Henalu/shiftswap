"use client";

import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  BriefcaseBusiness,
  CalendarCog,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  MessageSquare,
  Repeat,
  ShieldCheck,
  User,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { hasAdminPanelAccess, isSuperAdmin } from "@/lib/user-roles";
import type { UserRole } from "@/types";

export interface NavigationItem {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
}

export const PRIMARY_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    href: "/shifts",
    label: "Tablon",
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
    href: "/calendar",
    label: "Calendario",
    description: "Consulta tu horario mensual y vacaciones.",
    icon: CalendarRange,
  },
  {
    href: "/chat",
    label: "Chat",
    description: "Habla con otros compañeros sobre cada cambio.",
    icon: MessageSquare,
  },
  {
    href: "/exchanges",
    label: "Cambios",
    description: "Revisa acuerdos, firmas y estado del expediente.",
    icon: Repeat,
  },
];

/** Mobile bottom nav: replaces "Mis turnos" with "Calendario" to keep 4 columns. */
export const MOBILE_NAVIGATION_ITEMS: NavigationItem[] = [
  PRIMARY_NAVIGATION_ITEMS[0], // Tablon
  PRIMARY_NAVIGATION_ITEMS[2], // Calendario
  PRIMARY_NAVIGATION_ITEMS[3], // Chat
  PRIMARY_NAVIGATION_ITEMS[4], // Cambios
];

export const ACCOUNT_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    href: "/profile",
    label: "Mi perfil",
    description: "Consulta tus datos y preferencias basicas.",
    icon: User,
  },
  {
    href: "/help",
    label: "Ayuda",
    description: "Aprende como funciona la app y resuelve dudas.",
    icon: CircleHelp,
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
      label: "Aprobaciones",
      description: "Resuelve expedientes pendientes del equipo.",
      icon: ClipboardCheck,
    },
    {
      href: "/admin/department-changes",
      label: "Cambios de depto.",
      description: "Revisa traslados entre departamentos operativos.",
      icon: Workflow,
    },
    {
      href: "/admin/job-position-changes",
      label: "Cambios de puesto",
      description: "Revisa ajustes de puesto dentro de cada departamento.",
      icon: BriefcaseBusiness,
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
    adminItems.push({
      href: "/admin/users",
      label: "Usuarios y roles",
      description: "Gestiona permisos y alcance de cada cuenta.",
      icon: Users,
    });
  }

  return adminItems;
}

export function isNavigationItemActive(pathname: string, href: string) {
  switch (href) {
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
    case "/admin/department-changes":
      return pathname.startsWith("/admin/department-changes");
    case "/admin/job-position-changes":
      return pathname.startsWith("/admin/job-position-changes");
    case "/admin/users":
      return pathname.startsWith("/admin/users");
    case "/admin/schedule-config":
      return pathname.startsWith("/admin/schedule-config");
    default:
      return pathname === href || pathname.startsWith(`${href}/`);
  }
}
