import { redirect } from "next/navigation";
import { CalendarCog, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getDepartmentArea, getDepartmentById } from "@/lib/departments";
import { cn, PANEL_CLASSNAME } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasAdminPanelAccess, isSuperAdmin } from "@/lib/user-roles";
import { SCHEDULE_TYPE_LABELS } from "@/lib/constants";
import type { Department, ScheduleTypeCode, UserRole } from "@/types";
import { AreaConfigForm } from "@/app/(dashboard)/admin/schedule-config/area-config-form";
import { ScheduleConfigFilters } from "@/app/(dashboard)/admin/schedule-config/schedule-config-filters";
import { RotationAssignmentList } from "@/app/(dashboard)/admin/schedule-config/rotation-assignment-list";

interface AreaScheduleConfigRow {
  id: string;
  department_id: string;
  schedule_type: ScheduleTypeCode;
}

interface RotationGroupRow {
  id: string;
  code: string;
  label: string;
}

interface UserRotationAssignmentRow {
  id: string;
  user_id: string;
  rotation_group_id: string;
}

interface ScheduleUserRow {
  id: string;
  full_name: string;
  company_id: string | null;
  department_id: string | null;
}

interface PageProps {
  searchParams: Promise<{
    q?: string;
    schedule_type?: string;
  }>;
}

type ScheduleTypeFilter = ScheduleTypeCode | "unconfigured";

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isScheduleTypeFilter(
  value: string | undefined
): value is ScheduleTypeFilter {
  return value === "3t5" || value === "jornada_normal" || value === "unconfigured";
}

function getScheduleTypeLabel(scheduleType: ScheduleTypeCode | null) {
  return scheduleType ? SCHEDULE_TYPE_LABELS[scheduleType] : "Sin configurar";
}

function matchesSearch(parts: Array<string | null | undefined>, searchTerm: string) {
  if (!searchTerm) return true;

  return normalizeSearchValue(parts.filter(Boolean).join(" ")).includes(searchTerm);
}

function matchesScheduleType(
  scheduleType: ScheduleTypeCode | null,
  filter: ScheduleTypeFilter | ""
) {
  if (!filter) return true;
  if (filter === "unconfigured") return !scheduleType;

  return scheduleType === filter;
}

export default async function AdminScheduleConfigPage({ searchParams }: PageProps) {
  const { q, schedule_type } = await searchParams;
  const searchTerm = normalizeSearchValue(q?.trim() ?? "");
  const scheduleTypeFilter = isScheduleTypeFilter(schedule_type)
    ? schedule_type
    : "";

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("role, company_id, department_id")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!profile || !hasAdminPanelAccess(profile.role as UserRole)) {
    redirect("/shifts");
  }

  const superAdmin = isSuperAdmin(profile.role as UserRole);
  const userRole = profile.role as UserRole;

  // Load departments (areas = top-level)
  let deptQuery = admin
    .from("departments")
    .select("id, name, parent_department_id, company_id, is_assignable, created_at")
    .order("name");

  if (!superAdmin && profile.company_id) {
    deptQuery = deptQuery.eq("company_id", profile.company_id);
  }

  let usersQuery = admin
    .from("user_profiles")
    .select("id, full_name, company_id, department_id")
    .eq("validation_status", "approved")
    .order("full_name")
    .limit(200);

  if (!superAdmin && profile.company_id) {
    usersQuery = usersQuery.eq("company_id", profile.company_id);
  }

  if (userRole === "department_admin" && profile.department_id) {
    usersQuery = usersQuery.eq("department_id", profile.department_id);
  }

  const [
    { data: departments },
    { data: areaConfigs },
    { data: rotationGroups },
    { data: assignments },
    { data: users },
  ] = await Promise.all([
    deptQuery,
    admin.from("area_schedule_configs").select("id, department_id, schedule_type"),
    admin.from("rotation_groups").select("id, code, label").order("code"),
    admin.from("user_rotation_assignments").select("id, user_id, rotation_group_id"),
    usersQuery,
  ]);

  const typedDepartments = (departments ?? []) as Department[];
  const actorArea =
    userRole === "department_admin"
      ? getDepartmentArea(typedDepartments, profile.department_id)
      : null;
  const areas = typedDepartments.filter(
    (d) => !d.parent_department_id && (!actorArea || d.id === actorArea.id)
  );
  const typedAreaConfigs = (areaConfigs ?? []) as AreaScheduleConfigRow[];
  const typedRotationGroups = (rotationGroups ?? []) as RotationGroupRow[];
  const typedAssignments = (assignments ?? []) as UserRotationAssignmentRow[];
  const typedUsers = (users ?? []) as ScheduleUserRow[];
  const configMap = new Map(
    typedAreaConfigs.map((c) => [c.department_id, c])
  );
  const assignmentMap = new Map(
    typedAssignments.map((a) => [a.user_id, a.rotation_group_id])
  );
  const rotationGroupMap = new Map(
    typedRotationGroups.map((group) => [group.id, group])
  );
  const usersWithSchedule = typedUsers.map((user) => {
    const department =
      getDepartmentById(typedDepartments, user.department_id) ?? null;
    const area = getDepartmentArea(typedDepartments, user.department_id);
    const scheduleType = area
      ? configMap.get(area.id)?.schedule_type ?? null
      : null;
    const currentGroupId = assignmentMap.get(user.id) ?? null;
    const currentGroup = currentGroupId
      ? rotationGroupMap.get(currentGroupId) ?? null
      : null;

    return {
      ...user,
      areaName: area?.name ?? "Sin area",
      departmentName: department?.name ?? "Sin departamento",
      scheduleType,
      currentGroup,
      currentGroupId,
    };
  });
  const rotatingUsers = usersWithSchedule.filter(
    (user) => user.scheduleType === "3t5"
  );
  const filteredAreas = areas.filter((area) => {
    const scheduleType = configMap.get(area.id)?.schedule_type ?? null;

    return (
      matchesScheduleType(scheduleType, scheduleTypeFilter) &&
      matchesSearch([area.name, getScheduleTypeLabel(scheduleType)], searchTerm)
    );
  });
  const filteredRotatingUsers = rotatingUsers.filter((user) => {
    const scheduleType = user.scheduleType;

    return (
      matchesScheduleType(scheduleType, scheduleTypeFilter) &&
      matchesSearch(
        [
          user.full_name,
          user.areaName,
          user.departmentName,
          user.currentGroup?.label,
          getScheduleTypeLabel(scheduleType),
        ],
        searchTerm
      )
    );
  });
  const hasFilters = Boolean(searchTerm || scheduleTypeFilter);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Calendarios"
        description="Configura el tipo de jornada por area y asigna grupos de rotacion a los empleados."
      />

      <ScheduleConfigFilters
        filteredAreaCount={filteredAreas.length}
        filteredRotationUserCount={filteredRotatingUsers.length}
        totalAreaCount={areas.length}
        totalRotationUserCount={rotatingUsers.length}
      />

      {/* Area schedule type configuration */}
      <div className={cn(PANEL_CLASSNAME, "overflow-hidden")}>
        <div className="border-b border-border/60 px-5 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-foreground">
            Tipo de jornada por area
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Asigna 3T5 (turnos rotativos) o Jornada Normal a cada area.
          </p>
        </div>

        {filteredAreas.length > 0 ? (
          <div className="divide-y divide-border/60">
            {filteredAreas.map((area) => {
              const config = configMap.get(area.id);
              return (
                <div
                  key={area.id}
                  className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{area.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Actual:{" "}
                      {config
                        ? SCHEDULE_TYPE_LABELS[config.schedule_type as ScheduleTypeCode]
                        : "Sin configurar"}
                    </p>
                  </div>
                  <AreaConfigForm
                    departmentId={area.id}
                    currentType={config?.schedule_type ?? null}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={
                hasFilters ? (
                  <SearchX className="size-6" />
                ) : (
                  <CalendarCog className="size-6" />
                )
              }
              title={
                hasFilters ? "Sin areas con esos filtros" : "Sin areas disponibles"
              }
              description={
                hasFilters
                  ? "Prueba con otro nombre, otro tipo de jornada o limpia los filtros para volver a ver todas las areas."
                  : "No hay areas configuradas en el sistema."
              }
            />
          </div>
        )}
      </div>

      {typedRotationGroups.length > 0 && (
        <div className={cn(PANEL_CLASSNAME, "overflow-hidden")}>
          <div className="border-b border-border/60 px-5 py-3 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">
              Asignacion de grupos de rotacion
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Solo aparecen empleados de areas configuradas como 3T5.
            </p>
          </div>

          {filteredRotatingUsers.length > 0 ? (
            <RotationAssignmentList
              rotationGroups={typedRotationGroups}
              users={filteredRotatingUsers}
            />
          ) : (
            <div className="p-5">
              <EmptyState
                icon={
                  hasFilters ? (
                    <SearchX className="size-6" />
                  ) : (
                    <CalendarCog className="size-6" />
                  )
                }
                title={
                  hasFilters
                    ? "Sin empleados con esos filtros"
                    : "Sin empleados 3T5 para asignar"
                }
                description={
                  hasFilters
                    ? "Ajusta el nombre o vuelve a tipo 3T5 para ver empleados asignables a grupos de rotacion."
                    : "Configura primero un area como 3T5 o revisa que los empleados aprobados pertenezcan a esa area."
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
