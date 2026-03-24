import type { Department } from "@/types";

function compareDepartmentsByName(a: Department, b: Department) {
  return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
}

export function getDepartmentById(
  departments: Department[],
  departmentId: string | null | undefined
): Department | null {
  if (!departmentId) {
    return null;
  }

  return departments.find((department) => department.id === departmentId) ?? null;
}

export function hasChildDepartments(
  departments: Department[],
  departmentId: string
): boolean {
  return departments.some(
    (department) => department.parent_department_id === departmentId
  );
}

export function isOperationalDepartment(
  department: Department | null | undefined,
  departments: Department[]
): boolean {
  if (!department) {
    return false;
  }

  return Boolean(department.is_assignable) && !hasChildDepartments(departments, department.id);
}

export function getTopLevelDepartmentsForCompany(
  departments: Department[],
  companyId: string
): Department[] {
  return departments
    .filter(
      (department) =>
        department.company_id === companyId && !department.parent_department_id
    )
    .sort(compareDepartmentsByName);
}

export function getOperationalDepartmentsForArea(
  departments: Department[],
  companyId: string,
  areaDepartmentId: string
): Department[] {
  const directChildren = departments
    .filter(
      (department) =>
        department.company_id === companyId &&
        department.parent_department_id === areaDepartmentId &&
        isOperationalDepartment(department, departments)
    )
    .sort(compareDepartmentsByName);

  if (directChildren.length > 0) {
    return directChildren;
  }

  const selectedArea = getDepartmentById(departments, areaDepartmentId);
  if (
    selectedArea &&
    selectedArea.company_id === companyId &&
    isOperationalDepartment(selectedArea, departments)
  ) {
    return [selectedArea];
  }

  return [];
}

export function getDepartmentArea(
  departments: Department[],
  departmentId: string | null | undefined
): Department | null {
  const department = getDepartmentById(departments, departmentId);

  if (!department) {
    return null;
  }

  return getDepartmentById(departments, department.parent_department_id) ?? department;
}

export function getDepartmentScopeLabel(
  departments: Department[],
  departmentId: string | null | undefined
): string | null {
  const department = getDepartmentById(departments, departmentId);
  if (!department) {
    return null;
  }

  const area = getDepartmentArea(departments, departmentId);
  if (!area || area.id === department.id) {
    return department.name;
  }

  return `${area.name} · ${department.name}`;
}
