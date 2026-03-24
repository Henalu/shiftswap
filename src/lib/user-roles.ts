import type { UserRole } from "@/types";

export const ADMIN_PANEL_ROLES: readonly UserRole[] = [
  "department_admin",
  "hr_admin",
  "super_admin",
];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  member: "Miembro",
  department_admin: "Admin departamento",
  hr_admin: "Admin RR. HH.",
  super_admin: "Super admin",
};

interface UserScope {
  company_id: string | null;
  department_id: string | null;
}

interface DepartmentChangeRequestScope {
  company_id: string | null;
  current_department_id: string | null;
  requested_department_id: string | null;
}

export interface ScopedRoleUser extends UserScope {
  role: UserRole;
}

export function hasAdminPanelAccess(role: UserRole | null | undefined): boolean {
  return role === "department_admin" || role === "hr_admin" || role === "super_admin";
}

export function isSuperAdmin(role: UserRole | null | undefined): boolean {
  return role === "super_admin";
}

export function isUserRole(value: string): value is UserRole {
  return (
    value === "member" ||
    value === "department_admin" ||
    value === "hr_admin" ||
    value === "super_admin"
  );
}

export function canAccessScopedProfile(
  actor: ScopedRoleUser | null | undefined,
  target: UserScope | null | undefined
): boolean {
  if (!actor || !target) return false;

  if (actor.role === "super_admin") {
    return true;
  }

  if (!actor.company_id || !target.company_id) {
    return false;
  }

  if (actor.role === "hr_admin") {
    return actor.company_id === target.company_id;
  }

  if (!actor.department_id || !target.department_id) {
    return false;
  }

  return (
    actor.role === "department_admin" &&
    actor.company_id === target.company_id &&
    actor.department_id === target.department_id
  );
}

export function canAccessScopedDepartment(
  actor: ScopedRoleUser | null | undefined,
  target: UserScope | null | undefined
): boolean {
  return canAccessScopedProfile(actor, target);
}

export function canReviewDepartmentChangeRequest(
  actor: ScopedRoleUser | null | undefined,
  target: DepartmentChangeRequestScope | null | undefined
): boolean {
  if (!actor || !target) {
    return false;
  }

  if (actor.role === "super_admin") {
    return true;
  }

  if (!actor.company_id || !target.company_id || actor.company_id !== target.company_id) {
    return false;
  }

  if (actor.role === "hr_admin") {
    return true;
  }

  if (!actor.department_id) {
    return false;
  }

  return (
    actor.role === "department_admin" &&
    (actor.department_id === target.current_department_id ||
      actor.department_id === target.requested_department_id)
  );
}
