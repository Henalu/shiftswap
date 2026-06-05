import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  LaborPreferencesCard,
  type ProfileAreaScheduleConfig,
  type ProfileRotationGroupOption,
} from "./labor-preferences-card";
import { getDepartmentArea, getDepartmentById } from "@/lib/departments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { SuperAdminLaborScopeCard } from "./super-admin-labor-scope-card";
import type {
  Company,
  Department,
  JobPosition,
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

interface AreaScheduleConfigRow {
  department_id: string;
  schedule_type: ScheduleTypeCode;
}

interface RotationGroupRow {
  id: string;
  code: string;
  label: string;
}

interface UserSchedulePreferenceRow {
  schedule_type: ScheduleTypeCode;
}

interface UserRotationAssignmentRow {
  rotation_group_id: string;
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
      <div className="mx-auto w-full max-w-4xl space-y-6">
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
    { data: companyJobPositions },
    { data: areaScheduleConfigs },
    { data: userSchedulePreference },
    { data: userRotationAssignment },
    { data: rotationGroups },
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
          .order("name", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    isSuperAdminProfile
      ? adminClient
          .from("job_positions")
          .select(
            "id, company_id, department_id, name, code, active, created_at, updated_at"
          )
          .order("name", { ascending: true })
      : profile.company_id
      ? adminClient
          .from("job_positions")
          .select(
            "id, company_id, department_id, name, code, active, created_at, updated_at"
          )
          .eq("company_id", profile.company_id)
          .order("name", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    adminClient
      .from("area_schedule_configs")
      .select("department_id, schedule_type"),
    adminClient
      .from("user_schedule_preferences")
      .select("schedule_type")
      .eq("user_id", profile.id)
      .maybeSingle(),
    adminClient
      .from("user_rotation_assignments")
      .select("rotation_group_id")
      .eq("user_id", profile.id)
      .maybeSingle(),
    adminClient
      .from("rotation_groups")
      .select("id, code, label")
      .order("code", { ascending: true }),
  ]);

  const typedCompanies = (companies ?? []) as Pick<Company, "id" | "name">[];
  const typedDepartments = (companyDepartments ?? []) as Department[];
  const typedJobPositions = (companyJobPositions ?? []) as JobPosition[];
  const departmentIds = new Set(typedDepartments.map((department) => department.id));
  const typedAreaScheduleConfigs = (
    (areaScheduleConfigs ?? []) as AreaScheduleConfigRow[]
  ).filter((config) => departmentIds.has(config.department_id));
  const areaScheduleConfigMap = new Map(
    typedAreaScheduleConfigs.map((config) => [
      config.department_id,
      config.schedule_type,
    ])
  );
  const typedUserSchedulePreference =
    (userSchedulePreference as UserSchedulePreferenceRow | null) ?? null;
  const typedUserRotationAssignment =
    (userRotationAssignment as UserRotationAssignmentRow | null) ?? null;
  const typedRotationGroups = (rotationGroups ?? []) as RotationGroupRow[];
  const rotationGroupOptions: ProfileRotationGroupOption[] =
    typedRotationGroups.map((group) => ({
      id: group.id,
      code: group.code,
      label: group.label,
    }));
  const profileAreaScheduleConfigs: ProfileAreaScheduleConfig[] =
    typedAreaScheduleConfigs.map((config) => ({
      department_id: config.department_id,
      schedule_type: config.schedule_type,
    }));
  const currentDepartment =
    getDepartmentById(typedDepartments, profile.department_id) ?? null;
  const currentArea =
    getDepartmentArea(typedDepartments, profile.department_id) ?? currentDepartment;
  const currentJobPosition =
    typedJobPositions.find(
      (jobPosition) => jobPosition.id === profile.job_position_id
    ) ?? null;
  const currentScheduleType =
    typedUserSchedulePreference?.schedule_type ??
    (currentArea?.id ? areaScheduleConfigMap.get(currentArea.id) ?? null : null);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Gestiona tu identidad dentro de ShiftSwap y revisa los datos con los que participas en turnos, conversaciones y aprobaciones."
      />

      <ProfileForm
        profile={profile as ProfilePageProfile}
        userId={authUser.id}
      />

      {profile.company_id ? (
        <LaborPreferencesCard
          areaScheduleConfigs={profileAreaScheduleConfigs}
          companyId={profile.company_id}
          companyName={company?.name ?? "Sin empresa"}
          currentAreaId={currentArea?.id ?? null}
          currentDepartmentId={currentDepartment?.id ?? null}
          currentJobPositionId={currentJobPosition?.id ?? null}
          currentRotationGroupId={
            typedUserRotationAssignment?.rotation_group_id ?? null
          }
          currentScheduleType={currentScheduleType}
          departments={typedDepartments}
          employeeId={profile.employee_id ?? null}
          jobPositions={typedJobPositions}
          rotationGroups={rotationGroupOptions}
        />
      ) : null}

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
    </div>
  );
}
