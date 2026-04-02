import { redirect } from "next/navigation";
import { CalendarCog } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn, PANEL_CLASSNAME } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasAdminPanelAccess, isSuperAdmin } from "@/lib/user-roles";
import { ROTATION_GROUP_LABELS } from "@/lib/constants";
import type { UserRole } from "@/types";
import { AreaConfigForm } from "@/app/(dashboard)/admin/schedule-config/area-config-form";
import { UserRotationForm } from "@/app/(dashboard)/admin/schedule-config/user-rotation-form";

export default async function AdminScheduleConfigPage() {
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

  // Load departments (areas = top-level)
  let deptQuery = admin
    .from("departments")
    .select("id, name, parent_department_id, company_id")
    .order("name");

  if (!superAdmin && profile.company_id) {
    deptQuery = deptQuery.eq("company_id", profile.company_id);
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
    admin
      .from("user_profiles")
      .select("id, full_name, department_id")
      .eq("validation_status", "approved")
      .order("full_name")
      .limit(200),
  ]);

  const areas = (departments ?? []).filter((d) => !d.parent_department_id);
  const configMap = new Map(
    (areaConfigs ?? []).map((c) => [c.department_id, c])
  );
  const assignmentMap = new Map(
    (assignments ?? []).map((a) => [a.user_id, a.rotation_group_id])
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Calendarios"
        description="Configura el tipo de jornada por area y asigna grupos de rotacion a los empleados."
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

        {areas.length > 0 ? (
          <div className="divide-y divide-border/60">
            {areas.map((area) => {
              const config = configMap.get(area.id);
              return (
                <div
                  key={area.id}
                  className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{area.name}</p>
                    {config && (
                      <p className="text-xs text-muted-foreground">
                        Actual: {config.schedule_type === "3t5" ? "3T5 (rotativos)" : "Jornada normal"}
                      </p>
                    )}
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
              icon={<CalendarCog className="size-6" />}
              title="Sin areas disponibles"
              description="No hay areas configuradas en el sistema."
            />
          </div>
        )}
      </div>

      {/* User rotation group assignment (only for 3t5 areas) */}
      {(rotationGroups ?? []).length > 0 && (
        <div className={cn(PANEL_CLASSNAME, "overflow-hidden")}>
          <div className="border-b border-border/60 px-5 py-3 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">
              Asignacion de grupos de rotacion
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Solo para empleados en areas con jornada 3T5.
            </p>
          </div>

          {(users ?? []).length > 0 ? (
            <div className="divide-y divide-border/60">
              {(users ?? []).map((u) => {
                const currentGroupId = assignmentMap.get(u.id) ?? null;
                return (
                  <div
                    key={u.id}
                    className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {u.full_name}
                      </p>
                      {currentGroupId && (
                        <p className="text-xs text-muted-foreground">
                          {ROTATION_GROUP_LABELS[
                            (rotationGroups ?? []).find((g) => g.id === currentGroupId)?.code ?? ""
                          ] ?? "Sin grupo"}
                        </p>
                      )}
                    </div>
                    <UserRotationForm
                      userId={u.id}
                      currentGroupId={currentGroupId}
                      rotationGroups={rotationGroups ?? []}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5">
              <p className="text-sm text-muted-foreground">
                No hay empleados aprobados para asignar.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
