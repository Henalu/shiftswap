"use client";

import {
  CalendarCheck,
  CalendarDays,
  BriefcaseBusiness,
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
    href: "/chat",
    label: "Chat",
    description: "Habla con otros companeros sobre cada cambio.",
    icon: MessageSquare,
  },
  {
    href: "/exchanges",
    label: "Cambios",
    description: "Revisa acuerdos, firmas y estado del expediente.",
    icon: Repeat,
  },
];

export const ACCOUNT_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    href: "/profile",
    label: "Mi perfil",
    description: "Consulta tus datos y preferencias basicas.",
    icon: User,
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
    case "/chat":
      return pathname === "/chat" || pathname.startsWith("/chat/");
    case "/exchanges":
      return pathname === "/exchanges" || pathname.startsWith("/exchanges/");
    case "/profile":
      return pathname === "/profile" || pathname.startsWith("/profile/");
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
    default:
      return pathname === href || pathname.startsWith(`${href}/`);
  }
}
