import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  DepartmentChangeRequestCard,
  type ProfileDepartmentChangeRequestSummary,
} from "./department-change-request-card";
import {
  JobPositionChangeRequestCard,
  type ProfileJobPositionChangeRequestSummary,
} from "./job-position-change-request-card";
import { getDepartmentArea, getDepartmentById } from "@/lib/departments";
import {
  ROTATION_SEQUENCE_LABELS,
  SCHEDULE_TYPE_LABELS,
} from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickFirstRelation } from "@/lib/supabase-relations";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { SuperAdminLaborScopeCard } from "./super-admin-labor-scope-card";
import type {
  Company,
  Department,
  DepartmentChangeRequest,
  JobPosition,
  JobPositionChangeRequestStatus,
  ScheduleTypeCode,
  UserProfile,
} from "@/types";

type ProfilePageProfile = Pick<
  UserProfile,
  | "id"
  | "full_name"
  | "email"
  | "phone"
  | "avatar_url"
  | "signature_url"
  | "employee_id"
  | "company_id"
  | "department_id"
  | "job_position_id"
  | "role"
>;

interface ProfileJobPositionChangeRequestRow {
  id: string;
  user_id: string;
  company_id: string;
  current_department_id: string;
  current_job_position_id: string | null;
  requested_job_position_id: string;
  request_reason: string | null;
  review_notes: string | null;
  status: JobPositionChangeRequestStatus;
  created_at: string;
  reviewed_at: string | null;
  updated_at: string;
  current_job_position: {
    id: string;
    name: string;
  } | null;
  requested_job_position: {
    id: string;
    name: string;
  } | null;
}

interface AreaScheduleConfigRow {
  schedule_type: ScheduleTypeCode;
}

interface RotationGroupRow {
  id: string;
  code: string;
  label: string;
  rotation_pattern_id: string;
  reference_date: string;
}

interface RotationPatternRow {
  label: string;
  sequence: string[];
}

function formatRotationSequence(sequence: string[] | null | undefined) {
  if (!sequence?.length) {
    return "Sin secuencia configurada";
  }

  return sequence
    .map((letter) => ROTATION_SEQUENCE_LABELS[letter] ?? letter)
    .join(", ");
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const adminClient = createAdminClient();
  let profile: ProfilePageProfile | null = null;
  let profileLoadError = false;

  const { data: profileData, error: profileError } = await adminClient
    .from("user_profiles")
    .select(
      "id, full_name, email, phone, avatar_url, signature_url, employee_id, company_id, department_id, job_position_id, role"
    )
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError) {
    console.error("[profile/page] DB error fetching profile:", profileError);
    // Fallback: try a minimal query without potentially-missing columns
    const { data: fallback } = await adminClient
      .from("user_profiles")
      .select("id, full_name, email, phone, avatar_url, employee_id, company_id, department_id, job_position_id, role")
      .eq("id", authUser.id)
      .maybeSingle();

    if (fallback) {
      profile = { ...fallback, signature_url: null } as ProfilePageProfile;
    } else {
      profileLoadError = true;
    }
  } else {
    profile = profileData as ProfilePageProfile | null;
  }

  if (profileLoadError || !profile) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          eyebrow="Cuenta"
          title="Mi perfil"
          description="No se ha podido cargar tu perfil."
        />
        <div className="rounded-2xl border border-destructive/15 bg-destructive/10 p-6 text-sm text-foreground">
          <p className="font-semibold">Error al cargar el perfil</p>
          <p className="mt-2 text-muted-foreground">
            No hemos podido obtener tus datos. Esto puede ocurrir si faltan migraciones
            en la base de datos o si hay un problema temporal de conexion. Intenta
            recargar la pagina.
          </p>
        </div>
      </div>
    );
  }

  const isSuperAdminProfile = profile.role === "super_admin";

  const [
    { data: companies },
    { data: company },
    { data: companyDepartments },
    { data: departmentChangeRequests },
    { data: departmentJobPositions },
    { data: jobPositionChangeRequests },
  ] = await Promise.all([
      isSuperAdminProfile
        ? adminClient
            .from("companies")
            .select("id, name")
            .order("name", { ascending: true })
        : Promise.resolve({ data: null, error: null }),
      profile.company_id
        ? adminClient
            .from("companies")
            .select("name")
            .eq("id", profile.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      isSuperAdminProfile
        ? adminClient
            .from("departments")
            .select(
              "id, name, company_id, parent_department_id, is_assignable, created_at"
            )
            .order("name", { ascending: true })
        : profile.company_id
        ? adminClient
            .from("departments")
            .select(
              "id, name, company_id, parent_department_id, is_assignable, created_at"
            )
            .eq("company_id", profile.company_id)
        : Promise.resolve({ data: null, error: null }),
      profile.id
        ? adminClient
            .from("department_change_requests")
            .select(
              "id, user_id, company_id, current_department_id, requested_department_id, request_reason, status, review_notes, created_at, reviewed_at, updated_at"
            )
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null, error: null }),
      profile.department_id
        ? adminClient
            .from("job_positions")
            .select(
              "id, company_id, department_id, name, code, active, created_at, updated_at"
            )
            .eq("department_id", profile.department_id)
            .order("name", { ascending: true })
        : Promise.resolve({ data: null, error: null }),
      profile.id
        ? adminClient
            .from("job_position_change_requests")
            .select(
              `
              id, user_id, company_id, current_department_id, current_job_position_id,
              requested_job_position_id, request_reason, review_notes, status,
              created_at, reviewed_at, updated_at,
              current_job_position:job_positions!current_job_position_id(id, name),
              requested_job_position:job_positions!requested_job_position_id(id, name)
            `
            )
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null, error: null }),
    ]);

  const typedCompanies = (companies ?? []) as Pick<Company, "id" | "name">[];
  const typedDepartments = (companyDepartments ?? []) as Department[];
  const typedDepartmentJobPositions = (departmentJobPositions ?? []) as JobPosition[];
  const currentDepartment =
    getDepartmentById(typedDepartments, profile.department_id) ?? null;
  const currentArea =
    getDepartmentArea(typedDepartments, profile.department_id) ?? currentDepartment;
  const currentJobPosition =
    typedDepartmentJobPositions.find(
      (jobPosition) => jobPosition.id === profile.job_position_id
    ) ?? null;

  let scheduleTypeName = "Sin calendario configurado";
  let rotationGroupName = "Sin grupo asignado";
  let rotationPatternName = "No aplica";
  let rotationSequenceName =
    "El administrador debe configurar el calendario del area.";

  if (currentArea?.id) {
    const { data: areaScheduleConfig } = await adminClient
      .from("area_schedule_configs")
      .select("schedule_type")
      .eq("department_id", currentArea.id)
      .maybeSingle();
    const typedAreaScheduleConfig =
      areaScheduleConfig as AreaScheduleConfigRow | null;

    if (typedAreaScheduleConfig?.schedule_type) {
      scheduleTypeName =
        SCHEDULE_TYPE_LABELS[typedAreaScheduleConfig.schedule_type];

      if (typedAreaScheduleConfig.schedule_type === "jornada_normal") {
        rotationGroupName = "No aplica";
        rotationSequenceName =
          "Lun-Jue jornada completa, viernes jornada reducida";
      } else {
        const { data: assignment } = await adminClient
          .from("user_rotation_assignments")
          .select("rotation_group_id")
          .eq("user_id", profile.id)
          .maybeSingle();

        if (assignment?.rotation_group_id) {
          const { data: rotationGroup } = await adminClient
            .from("rotation_groups")
            .select("id, code, label, rotation_pattern_id, reference_date")
            .eq("id", assignment.rotation_group_id)
            .maybeSingle();
          const typedRotationGroup = rotationGroup as RotationGroupRow | null;

          if (typedRotationGroup) {
            rotationGroupName = typedRotationGroup.label;

            const { data: rotationPattern } = await adminClient
              .from("rotation_patterns")
              .select("label, sequence")
              .eq("id", typedRotationGroup.rotation_pattern_id)
              .maybeSingle();
            const typedRotationPattern =
              rotationPattern as RotationPatternRow | null;

            if (typedRotationPattern) {
              rotationPatternName = typedRotationPattern.label;
              rotationSequenceName = formatRotationSequence(
                typedRotationPattern.sequence
              );
            }
          }
        }
      }
    }
  }

  const typedDepartmentRequests = (
    (departmentChangeRequests ?? []) as DepartmentChangeRequest[]
  ).map((request) => {
      const currentRequestDepartment =
        getDepartmentById(typedDepartments, request.current_department_id) ?? null;
      const requestedRequestDepartment =
        getDepartmentById(typedDepartments, request.requested_department_id) ?? null;
      const currentRequestArea =
        getDepartmentArea(typedDepartments, request.current_department_id) ??
        currentRequestDepartment;
      const requestedRequestArea =
        getDepartmentArea(typedDepartments, request.requested_department_id) ??
        requestedRequestDepartment;

      return {
        ...request,
        currentAreaName: currentRequestArea?.name ?? "Sin area",
        currentDepartmentName: currentRequestDepartment?.name ?? "Sin departamento",
        requestedAreaName: requestedRequestArea?.name ?? "Sin area",
        requestedDepartmentName:
          requestedRequestDepartment?.name ?? "Sin departamento",
      } satisfies ProfileDepartmentChangeRequestSummary;
    });
  const typedJobPositionRequests = (
    (jobPositionChangeRequests ?? []) as unknown[]
  ).map((request) => {
    const typedRequest = request as ProfileJobPositionChangeRequestRow & {
      current_job_position:
        | ProfileJobPositionChangeRequestRow["current_job_position"]
        | ProfileJobPositionChangeRequestRow["current_job_position"][];
      requested_job_position:
        | ProfileJobPositionChangeRequestRow["requested_job_position"]
        | ProfileJobPositionChangeRequestRow["requested_job_position"][];
    };
    const currentRequestDepartment =
      getDepartmentById(typedDepartments, typedRequest.current_department_id) ?? null;
    const currentRequestArea =
      getDepartmentArea(typedDepartments, typedRequest.current_department_id) ??
      currentRequestDepartment;
    const currentRequestJobPosition = pickFirstRelation(
      typedRequest.current_job_position
    );
    const requestedRequestJobPosition = pickFirstRelation(
      typedRequest.requested_job_position
    );

    return {
      ...typedRequest,
      currentAreaName: currentRequestArea?.name ?? "Sin area",
      currentDepartmentName: currentRequestDepartment?.name ?? "Sin departamento",
      currentJobPositionName:
        currentRequestJobPosition?.name ?? "Sin puesto asignado",
      requestedJobPositionName:
        requestedRequestJobPosition?.name ?? "Puesto no disponible",
    } satisfies ProfileJobPositionChangeRequestSummary;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Gestiona tu identidad dentro de ShiftSwap y revisa los datos con los que participas en turnos, conversaciones y aprobaciones."
      />

      <ProfileForm
        profile={profile as ProfilePageProfile}
        companyName={company?.name ?? "Sin empresa"}
        areaName={currentArea?.name ?? "Sin area"}
        departmentName={currentDepartment?.name ?? "Sin departamento"}
        jobPositionName={currentJobPosition?.name ?? "Sin puesto asignado"}
        scheduleTypeName={scheduleTypeName}
        rotationGroupName={rotationGroupName}
        rotationPatternName={rotationPatternName}
        rotationSequenceName={rotationSequenceName}
        userId={authUser.id}
      />

      {isSuperAdminProfile ? (
        <SuperAdminLaborScopeCard
          companies={typedCompanies}
          departments={typedDepartments}
          currentCompanyId={profile.company_id}
          currentDepartmentId={profile.department_id}
          currentCompanyName={company?.name ?? "Sin empresa asignada"}
          currentAreaName={currentArea?.name ?? "Sin area asignada"}
          currentDepartmentName={
            currentDepartment?.name ?? "Sin departamento asignado"
          }
        />
      ) : null}

      {!isSuperAdminProfile && profile.company_id && profile.department_id ? (
        <DepartmentChangeRequestCard
          companyName={company?.name ?? "Sin empresa"}
          currentDepartmentId={profile.department_id}
          currentAreaName={currentArea?.name ?? "Sin area"}
          currentDepartmentName={currentDepartment?.name ?? "Sin departamento"}
          departments={typedDepartments}
          requests={typedDepartmentRequests}
        />
      ) : null}

      {!isSuperAdminProfile && profile.company_id && profile.department_id ? (
        <JobPositionChangeRequestCard
          companyName={company?.name ?? "Sin empresa"}
          currentAreaName={currentArea?.name ?? "Sin area"}
          currentDepartmentName={currentDepartment?.name ?? "Sin departamento"}
          currentJobPositionId={profile.job_position_id ?? null}
          currentJobPositionName={currentJobPosition?.name ?? "Sin puesto asignado"}
          jobPositions={typedDepartmentJobPositions}
          requests={typedJobPositionRequests}
        />
      ) : null}
    </div>
  );
}
