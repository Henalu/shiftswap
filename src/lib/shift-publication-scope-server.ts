import {
  getDepartmentById,
  isOperationalDepartment,
} from "@/lib/departments";
import {
  getCustomJobPositionNameError,
  normalizeCustomJobPositionName,
} from "@/lib/custom-job-position";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Department, JobPosition } from "@/types";

export interface ShiftPublicationScopeData {
  companyId: string;
  defaultDepartmentId: string;
  defaultJobPositionId: string | null;
  departments: Department[];
  jobPositions: JobPosition[];
}

export type ShiftPublicationScopeLoadResult =
  | { success: true; data: ShiftPublicationScopeData }
  | {
      success: false;
      error: string;
      actionHref?: string;
      actionLabel?: string;
    };

type ResolvedShiftPublicationScope =
  | {
      success: true;
      departmentId: string;
      jobPositionId: string | null;
      customJobPositionName: string | null;
    }
  | { success: false; error: string };

interface ProfileScopeRow {
  company_id: string | null;
  department_id: string | null;
  job_position_id: string | null;
}

function getFormValue(formData: FormData, name: string) {
  return ((formData.get(name) as string | null) ?? "").trim();
}

export async function getShiftPublicationScopeData(
  userId: string,
): Promise<ShiftPublicationScopeLoadResult> {
  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles")
    .select("company_id, department_id, job_position_id")
    .eq("id", userId)
    .maybeSingle();

  const typedProfile = profile as ProfileScopeRow | null;

  if (profileError) {
    return {
      success: false,
      error: "No hemos podido verificar tu perfil laboral para publicar.",
    };
  }

  if (!typedProfile?.company_id || !typedProfile.department_id) {
    return {
      success: false,
      error:
        "Necesitas tener empresa y departamento operativo asignados antes de publicar un turno.",
      actionHref: "/profile",
      actionLabel: "Ir a mi perfil",
    };
  }

  const [{ data: departments }, { data: jobPositions }] = await Promise.all([
    adminClient
      .from("departments")
      .select("id, name, company_id, parent_department_id, is_assignable, created_at")
      .eq("company_id", typedProfile.company_id)
      .order("name", { ascending: true }),
    adminClient
      .from("job_positions")
      .select("id, company_id, department_id, name, code, active, created_at, updated_at")
      .eq("company_id", typedProfile.company_id)
      .eq("active", true)
      .order("name", { ascending: true }),
  ]);

  const typedDepartments = (departments ?? []) as Department[];
  const typedJobPositions = (jobPositions ?? []) as JobPosition[];
  const currentDepartment = getDepartmentById(
    typedDepartments,
    typedProfile.department_id,
  );

  if (!isOperationalDepartment(currentDepartment, typedDepartments)) {
    return {
      success: false,
      error:
        "Tu cuenta sigue asociada a un area general. Elige un departamento operativo final antes de publicar.",
      actionHref: "/profile",
      actionLabel: "Ir a mi perfil",
    };
  }

  const currentJobPositionFits =
    typedProfile.job_position_id &&
    typedJobPositions.some(
      (jobPosition) =>
        jobPosition.id === typedProfile.job_position_id &&
        jobPosition.department_id === typedProfile.department_id,
    );

  return {
    success: true,
    data: {
      companyId: typedProfile.company_id,
      defaultDepartmentId: typedProfile.department_id,
      defaultJobPositionId: currentJobPositionFits
        ? typedProfile.job_position_id
        : null,
      departments: typedDepartments,
      jobPositions: typedJobPositions,
    },
  };
}

export async function resolveShiftPublicationScope(
  userId: string,
  formData: FormData,
): Promise<ResolvedShiftPublicationScope> {
  const scopeResult = await getShiftPublicationScopeData(userId);

  if (!scopeResult.success) {
    return { success: false, error: scopeResult.error };
  }

  const { defaultDepartmentId, departments, jobPositions } = scopeResult.data;
  const submittedDepartmentId = getFormValue(formData, "department_id");
  const submittedJobPositionId = getFormValue(formData, "job_position_id");
  const submittedCustomJobPositionName = normalizeCustomJobPositionName(
    getFormValue(formData, "custom_job_position_name"),
  );
  const departmentId = submittedDepartmentId || defaultDepartmentId;
  const department = getDepartmentById(departments, departmentId);

  if (!department || !isOperationalDepartment(department, departments)) {
    return {
      success: false,
      error: "Selecciona un departamento operativo valido para publicar.",
    };
  }

  if (submittedJobPositionId && submittedCustomJobPositionName) {
    return {
      success: false,
      error: "Elige un puesto existente o escribe otro, pero no ambos.",
    };
  }

  if (submittedCustomJobPositionName) {
    const customJobPositionError = getCustomJobPositionNameError(
      submittedCustomJobPositionName,
    );

    if (customJobPositionError) {
      return {
        success: false,
        error: customJobPositionError,
      };
    }

    return {
      success: true,
      departmentId,
      jobPositionId: null,
      customJobPositionName: submittedCustomJobPositionName,
    };
  }

  if (!submittedJobPositionId) {
    return {
      success: true,
      departmentId,
      jobPositionId: null,
      customJobPositionName: null,
    };
  }

  const jobPosition = jobPositions.find(
    (position) => position.id === submittedJobPositionId,
  );

  if (
    !jobPosition ||
    !jobPosition.active ||
    jobPosition.company_id !== department.company_id ||
    jobPosition.department_id !== departmentId
  ) {
    return {
      success: false,
      error:
        "Selecciona un puesto activo que pertenezca al departamento elegido.",
    };
  }

  return {
    success: true,
    departmentId,
    jobPositionId: jobPosition.id,
    customJobPositionName: null,
  };
}
