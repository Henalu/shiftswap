"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarCog,
  IdCard,
  Loader2,
  Repeat,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SCHEDULE_TYPE_LABELS } from "@/lib/constants";
import {
  getOperationalDepartmentsForArea,
  getTopLevelDepartmentsForCompany,
} from "@/lib/departments";
import { FORM_CONTROL_CLASSNAME, PANEL_CLASSNAME, cn } from "@/lib/utils";
import type { Department, JobPosition, ScheduleTypeCode } from "@/types";
import { updateLaborPreferences } from "./actions";

export interface ProfileAreaScheduleConfig {
  department_id: string;
  schedule_type: ScheduleTypeCode;
}

export interface ProfileRotationGroupOption {
  id: string;
  code: string;
  label: string;
  patternLabel: string;
  sequenceLabel: string;
}

interface LaborPreferencesCardProps {
  areaScheduleConfigs: ProfileAreaScheduleConfig[];
  companyId: string;
  companyName: string;
  currentAreaId: string | null;
  currentDepartmentId: string | null;
  currentJobPositionId: string | null;
  currentRotationGroupId: string | null;
  currentScheduleType: ScheduleTypeCode | null;
  departments: Department[];
  employeeId: string | null;
  jobPositions: JobPosition[];
  rotationGroups: ProfileRotationGroupOption[];
}

interface InfoTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoTile({ icon, label, value }: InfoTileProps) {
  return (
    <div className={cn(PANEL_CLASSNAME, "flex min-w-0 items-start gap-3 px-4 py-4")}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
        {icon}
      </span>
      <span className="min-w-0 space-y-1">
        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <span className="block break-words text-sm font-medium text-foreground">
          {value}
        </span>
      </span>
    </div>
  );
}

function getAreaScheduleType(
  areaScheduleConfigs: ProfileAreaScheduleConfig[],
  areaDepartmentId: string
) {
  return (
    areaScheduleConfigs.find((config) => config.department_id === areaDepartmentId)
      ?.schedule_type ?? null
  );
}

function getInitialAreaId(
  availableAreas: Department[],
  currentAreaId: string | null
) {
  if (currentAreaId && availableAreas.some((area) => area.id === currentAreaId)) {
    return currentAreaId;
  }

  return availableAreas[0]?.id ?? "";
}

function getInitialDepartmentId(
  departments: Department[],
  companyId: string,
  areaDepartmentId: string,
  currentDepartmentId: string | null
) {
  const availableDepartments = getOperationalDepartmentsForArea(
    departments,
    companyId,
    areaDepartmentId
  );

  if (
    currentDepartmentId &&
    availableDepartments.some((department) => department.id === currentDepartmentId)
  ) {
    return currentDepartmentId;
  }

  return availableDepartments[0]?.id ?? "";
}

function getInitialScheduleType(
  areaScheduleConfigs: ProfileAreaScheduleConfig[],
  areaDepartmentId: string,
  currentScheduleType: ScheduleTypeCode | null
): ScheduleTypeCode {
  return (
    currentScheduleType ??
    getAreaScheduleType(areaScheduleConfigs, areaDepartmentId) ??
    "3t5"
  );
}

function getInitialJobPositionId(
  jobPositions: JobPosition[],
  departmentId: string,
  currentJobPositionId: string | null
) {
  if (
    currentJobPositionId &&
    jobPositions.some(
      (jobPosition) =>
        jobPosition.id === currentJobPositionId &&
        jobPosition.active &&
        jobPosition.department_id === departmentId
    )
  ) {
    return currentJobPositionId;
  }

  return "";
}

function getInitialRotationGroupId(
  rotationGroups: ProfileRotationGroupOption[],
  currentRotationGroupId: string | null
) {
  if (
    currentRotationGroupId &&
    rotationGroups.some((group) => group.id === currentRotationGroupId)
  ) {
    return currentRotationGroupId;
  }

  return rotationGroups[0]?.id ?? "";
}

export function LaborPreferencesCard({
  areaScheduleConfigs,
  companyId,
  companyName,
  currentAreaId,
  currentDepartmentId,
  currentJobPositionId,
  currentRotationGroupId,
  currentScheduleType,
  departments,
  employeeId,
  jobPositions,
  rotationGroups,
}: LaborPreferencesCardProps) {
  const router = useRouter();
  const availableAreas = useMemo(
    () => getTopLevelDepartmentsForCompany(departments, companyId),
    [companyId, departments]
  );
  const initialAreaId = getInitialAreaId(availableAreas, currentAreaId);
  const initialDepartmentId = getInitialDepartmentId(
    departments,
    companyId,
    initialAreaId,
    currentDepartmentId
  );
  const [areaDepartmentId, setAreaDepartmentId] = useState(initialAreaId);
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);
  const [jobPositionId, setJobPositionId] = useState(() =>
    getInitialJobPositionId(jobPositions, initialDepartmentId, currentJobPositionId)
  );
  const [scheduleType, setScheduleType] = useState<ScheduleTypeCode>(() =>
    getInitialScheduleType(areaScheduleConfigs, initialAreaId, currentScheduleType)
  );
  const [rotationGroupId, setRotationGroupId] = useState(
    getInitialRotationGroupId(rotationGroups, currentRotationGroupId)
  );
  const [submitting, setSubmitting] = useState(false);

  const availableDepartments = useMemo(
    () =>
      getOperationalDepartmentsForArea(
        departments,
        companyId,
        areaDepartmentId
      ),
    [areaDepartmentId, companyId, departments]
  );
  const availableJobPositions = useMemo(
    () =>
      jobPositions.filter(
        (jobPosition) =>
          jobPosition.active && jobPosition.department_id === departmentId
      ),
    [departmentId, jobPositions]
  );
  const selectedRotationGroup = rotationGroups.find(
    (group) => group.id === rotationGroupId
  );
  const selectedAreaDefault = getAreaScheduleType(
    areaScheduleConfigs,
    areaDepartmentId
  );
  const canSave =
    Boolean(companyId && areaDepartmentId && departmentId) &&
    (scheduleType !== "3t5" || Boolean(rotationGroupId));

  function handleAreaChange(nextAreaDepartmentId: string) {
    const nextDepartments = getOperationalDepartmentsForArea(
      departments,
      companyId,
      nextAreaDepartmentId
    );
    const nextDepartmentId = nextDepartments[0]?.id ?? "";
    const nextAreaScheduleType = getAreaScheduleType(
      areaScheduleConfigs,
      nextAreaDepartmentId
    );

    setAreaDepartmentId(nextAreaDepartmentId);
    setDepartmentId(nextDepartmentId);
    setJobPositionId("");

    if (nextAreaScheduleType) {
      setScheduleType(nextAreaScheduleType);
    }
  }

  function handleDepartmentChange(nextDepartmentId: string) {
    setDepartmentId(nextDepartmentId);

    const selectedJobStillFits = jobPositions.some(
      (jobPosition) =>
        jobPosition.id === jobPositionId &&
        jobPosition.active &&
        jobPosition.department_id === nextDepartmentId
    );

    if (!selectedJobStillFits) {
      setJobPositionId("");
    }
  }

  function handleScheduleTypeChange(nextScheduleType: ScheduleTypeCode) {
    setScheduleType(nextScheduleType);

    if (nextScheduleType === "3t5" && !rotationGroupId) {
      setRotationGroupId(rotationGroups[0]?.id ?? "");
    }
  }

  async function handleSubmit() {
    if (!canSave) {
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.set("area_department_id", areaDepartmentId);
    formData.set("department_id", departmentId);
    formData.set("schedule_type", scheduleType);

    if (jobPositionId) {
      formData.set("job_position_id", jobPositionId);
    }

    if (scheduleType === "3t5" && rotationGroupId) {
      formData.set("rotation_group_id", rotationGroupId);
    }

    try {
      const result = await updateLaborPreferences(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Configuracion laboral guardada.");
      router.refresh();
    } catch {
      toast.error("No se pudo guardar la configuracion laboral.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle>Configuracion laboral</CardTitle>
            <CardDescription>
              Ajusta tu departamento, puesto, jornada y grupo de rotacion cuando
              cambie tu situacion real.
            </CardDescription>
          </div>
          <Badge className="border-emerald-500/15 bg-emerald-500/10 text-emerald-700">
            Cambio inmediato
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoTile
            icon={<Building2 className="size-4" />}
            label="Empresa"
            value={companyName}
          />
          <InfoTile
            icon={<IdCard className="size-4" />}
            label="ID empleado"
            value={employeeId?.trim() || "No disponible"}
          />
          <InfoTile
            icon={<CalendarCog className="size-4" />}
            label="Jornada actual"
            value={SCHEDULE_TYPE_LABELS[scheduleType]}
          />
          <InfoTile
            icon={<Repeat className="size-4" />}
            label="Grupo actual"
            value={
              scheduleType === "3t5"
                ? selectedRotationGroup?.label ?? "Sin grupo"
                : "No aplica"
            }
          />
        </div>

        <div className="space-y-5 rounded-2xl border border-border/70 bg-secondary/20 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="labor-area-department">Area o taller</Label>
              <select
                id="labor-area-department"
                value={areaDepartmentId}
                onChange={(event) => handleAreaChange(event.target.value)}
                disabled={submitting || availableAreas.length === 0}
                className={FORM_CONTROL_CLASSNAME}
              >
                {availableAreas.length === 0 ? (
                  <option value="">Sin areas disponibles</option>
                ) : null}
                {availableAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="labor-department">Departamento operativo</Label>
              <select
                id="labor-department"
                value={departmentId}
                onChange={(event) => handleDepartmentChange(event.target.value)}
                disabled={submitting || availableDepartments.length === 0}
                className={FORM_CONTROL_CLASSNAME}
              >
                {availableDepartments.length === 0 ? (
                  <option value="">Sin departamentos disponibles</option>
                ) : null}
                {availableDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="labor-job-position">Puesto de trabajo</Label>
              <select
                id="labor-job-position"
                value={jobPositionId}
                onChange={(event) => setJobPositionId(event.target.value)}
                disabled={submitting}
                className={FORM_CONTROL_CLASSNAME}
              >
                <option value="">Sin puesto asignado</option>
                {availableJobPositions.map((jobPosition) => (
                  <option key={jobPosition.id} value={jobPosition.id}>
                    {jobPosition.name}
                  </option>
                ))}
              </select>
              {availableJobPositions.length === 0 ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  No hay puestos activos para este departamento.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="labor-schedule-type">Tipo de jornada</Label>
              <select
                id="labor-schedule-type"
                value={scheduleType}
                onChange={(event) =>
                  handleScheduleTypeChange(event.target.value as ScheduleTypeCode)
                }
                disabled={submitting}
                className={FORM_CONTROL_CLASSNAME}
              >
                <option value="3t5">3T5 (turnos rotativos)</option>
                <option value="jornada_normal">Jornada normal</option>
              </select>
              {selectedAreaDefault ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  Predeterminado del area: {SCHEDULE_TYPE_LABELS[selectedAreaDefault]}.
                </p>
              ) : null}
            </div>

            {scheduleType === "3t5" ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="labor-rotation-group">Grupo de rotacion</Label>
                <select
                  id="labor-rotation-group"
                  value={rotationGroupId}
                  onChange={(event) => setRotationGroupId(event.target.value)}
                  disabled={submitting || rotationGroups.length === 0}
                  className={FORM_CONTROL_CLASSNAME}
                >
                  {rotationGroups.length === 0 ? (
                    <option value="">Sin grupos disponibles</option>
                  ) : null}
                  {rotationGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label} - {group.patternLabel}
                    </option>
                  ))}
                </select>
                {selectedRotationGroup ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Secuencia: {selectedRotationGroup.sequenceLabel}.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className={cn(PANEL_CLASSNAME, "md:col-span-2 px-4 py-4")}>
                <div className="flex items-start gap-3">
                  <Workflow className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Jornada normal
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      No necesita grupo de rotacion. El calendario usara jornada
                      completa de lunes a jueves y reducida los viernes.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave || submitting}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitting ? "Guardando..." : "Guardar configuracion laboral"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
