"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Building2,
  CalendarCog,
  IdCard,
  Loader2,
  Pencil,
  Workflow,
  X,
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
import { Input } from "@/components/ui/input";
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

interface LaborFieldTileProps {
  children?: React.ReactNode;
  description?: string;
  editing?: boolean;
  fieldId?: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}

function LaborFieldTile({
  children,
  description,
  editing = false,
  fieldId,
  icon,
  label,
  value,
}: LaborFieldTileProps) {
  const labelClassName =
    "block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground";

  return (
    <div className={cn(PANEL_CLASSNAME, "flex min-w-0 items-start gap-3 px-4 py-4")}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {editing && fieldId ? (
          <Label htmlFor={fieldId} className={labelClassName}>
            {label}
          </Label>
        ) : (
          <span className={labelClassName}>{label}</span>
        )}

        {editing && children ? (
          <div className="space-y-2">
            {children}
            {description ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="block break-words text-sm font-medium text-foreground">
            {value}
          </span>
        )}
      </div>
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
  const initialJobPositionId = getInitialJobPositionId(
    jobPositions,
    initialDepartmentId,
    currentJobPositionId
  );
  const initialScheduleType = getInitialScheduleType(
    areaScheduleConfigs,
    initialAreaId,
    currentScheduleType
  );
  const initialRotationGroupId = getInitialRotationGroupId(
    rotationGroups,
    currentRotationGroupId
  );
  const initialEmployeeId = employeeId?.trim() ?? "";
  const [isEditing, setIsEditing] = useState(false);
  const [employeeIdValue, setEmployeeIdValue] = useState(initialEmployeeId);
  const [areaDepartmentId, setAreaDepartmentId] = useState(initialAreaId);
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);
  const [jobPositionId, setJobPositionId] = useState(initialJobPositionId);
  const [scheduleType, setScheduleType] =
    useState<ScheduleTypeCode>(initialScheduleType);
  const [rotationGroupId, setRotationGroupId] = useState(initialRotationGroupId);
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
  const selectedArea =
    availableAreas.find((area) => area.id === areaDepartmentId) ?? null;
  const selectedDepartment =
    departments.find((department) => department.id === departmentId) ?? null;
  const selectedJobPosition =
    jobPositions.find((jobPosition) => jobPosition.id === jobPositionId) ?? null;
  const selectedRotationGroup =
    rotationGroups.find((group) => group.id === rotationGroupId) ?? null;
  const selectedAreaDefault = getAreaScheduleType(
    areaScheduleConfigs,
    areaDepartmentId
  );
  const effectiveInitialRotationGroupId =
    initialScheduleType === "3t5" ? initialRotationGroupId : "";
  const effectiveRotationGroupId =
    scheduleType === "3t5" ? rotationGroupId : "";
  const hasChanges =
    employeeIdValue.trim() !== initialEmployeeId ||
    areaDepartmentId !== initialAreaId ||
    departmentId !== initialDepartmentId ||
    jobPositionId !== initialJobPositionId ||
    scheduleType !== initialScheduleType ||
    effectiveRotationGroupId !== effectiveInitialRotationGroupId;
  const canSave =
    Boolean(companyId && areaDepartmentId && departmentId) &&
    (scheduleType !== "3t5" || Boolean(rotationGroupId)) &&
    hasChanges;

  function resetForm() {
    setEmployeeIdValue(initialEmployeeId);
    setAreaDepartmentId(initialAreaId);
    setDepartmentId(initialDepartmentId);
    setJobPositionId(initialJobPositionId);
    setScheduleType(initialScheduleType);
    setRotationGroupId(initialRotationGroupId);
  }

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
    formData.set("employee_id", employeeIdValue.trim());
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
      setIsEditing(false);
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
            <CardTitle>Datos laborales</CardTitle>
            <CardDescription>
              Estos datos se usan para calendario, publicaciones y documentos.
              Los cambios se aplican directamente en {companyName}.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-emerald-500/15 bg-emerald-500/10 text-emerald-700">
              Cambio inmediato
            </Badge>
            {isEditing ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsEditing(false);
                }}
                disabled={submitting}
              >
                <X className="size-4" />
                Cancelar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LaborFieldTile
            icon={<Building2 className="size-4" />}
            label="Area o taller"
            value={selectedArea?.name ?? "Sin area asignada"}
            editing={isEditing}
            fieldId="labor-area-department"
          >
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
          </LaborFieldTile>

          <LaborFieldTile
            icon={<IdCard className="size-4" />}
            label="ID de empleado"
            value={employeeIdValue.trim() || "No disponible"}
            editing={isEditing}
            fieldId="labor-employee-id"
          >
            <Input
              id="labor-employee-id"
              value={employeeIdValue}
              onChange={(event) => setEmployeeIdValue(event.target.value)}
              disabled={submitting}
              placeholder="No disponible"
            />
          </LaborFieldTile>

          <LaborFieldTile
            icon={<Workflow className="size-4" />}
            label="Departamento"
            value={selectedDepartment?.name ?? "Sin departamento asignado"}
            editing={isEditing}
            fieldId="labor-department"
          >
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
          </LaborFieldTile>

          <LaborFieldTile
            icon={<BriefcaseBusiness className="size-4" />}
            label="Puesto de trabajo"
            value={selectedJobPosition?.name ?? "Sin puesto asignado"}
            editing={isEditing}
            fieldId="labor-job-position"
            description={
              isEditing && availableJobPositions.length === 0
                ? "No hay puestos activos para este departamento."
                : undefined
            }
          >
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
          </LaborFieldTile>

          <LaborFieldTile
            icon={<CalendarCog className="size-4" />}
            label="Tipo de jornada"
            value={SCHEDULE_TYPE_LABELS[scheduleType]}
            editing={isEditing}
            fieldId="labor-schedule-type"
            description={
              isEditing && selectedAreaDefault
                ? `Predeterminado del area: ${SCHEDULE_TYPE_LABELS[selectedAreaDefault]}.`
                : undefined
            }
          >
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
          </LaborFieldTile>

          {scheduleType === "3t5" ? (
            <LaborFieldTile
              icon={<Workflow className="size-4" />}
              label="Grupo de rotacion"
              value={selectedRotationGroup?.label ?? "Sin grupo asignado"}
              editing={isEditing}
              fieldId="labor-rotation-group"
              description={
                isEditing
                  ? "Solo se usa para calcular tu calendario 3T5."
                  : undefined
              }
            >
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
                    {group.label}
                  </option>
                ))}
              </select>
            </LaborFieldTile>
          ) : null}
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave || submitting}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
