"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deletePlatformDepartmentAction,
  deletePlatformJobPositionAction,
  deletePlatformScheduleConfigAction,
  updatePlatformDepartmentAction,
  updatePlatformJobPositionAction,
  updatePlatformScheduleConfigAction,
} from "@/lib/platform-console-actions";

type ScheduleType = "3t5" | "jornada_normal";

interface CompanyOption {
  id: string;
  name: string;
}

interface DepartmentOption {
  company_id: string;
  id: string;
  is_assignable: boolean;
  name: string;
  parent_department_id: string | null;
}

interface JobPositionOption {
  active: boolean;
  code: string | null;
  company_id: string;
  department_id: string;
  id: string;
  name: string;
}

interface ScheduleConfigOption {
  department_id: string;
  id: string;
  schedule_type: ScheduleType;
}

const SELECT_CLASSNAME =
  "h-10 rounded-xl border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60";

function Field({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function scheduleTypeLabel(value: ScheduleType | null | undefined) {
  switch (value) {
    case "3t5":
      return "3 turnos / 5 grupos";
    case "jornada_normal":
      return "Jornada normal";
    default:
      return "Sin configurar";
  }
}

function ConfirmDeleteForm({
  action,
  children,
  confirmMessage,
  hiddenName,
  hiddenValue,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  confirmMessage: string;
  hiddenName: string;
  hiddenValue: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input name={hiddenName} type="hidden" value={hiddenValue} />
      {children}
    </form>
  );
}

export function ManagedDepartmentsList({
  canManage,
  companies,
  departments,
}: {
  canManage: boolean;
  companies: CompanyOption[];
  departments: DepartmentOption[];
}) {
  const companyMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies]
  );
  const departmentMap = useMemo(
    () =>
      new Map(departments.map((department) => [department.id, department])),
    [departments]
  );

  if (departments.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/80 px-3 py-6 text-center text-sm text-muted-foreground">
        Sin departamentos todavia.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {departments.map((department) => (
        <ManagedDepartmentRow
          canManage={canManage}
          companyName={companyMap.get(department.company_id)?.name ?? "Sin empresa"}
          department={department}
          departments={departments}
          key={department.id}
          parentName={
            department.parent_department_id
              ? departmentMap.get(department.parent_department_id)?.name
              : null
          }
        />
      ))}
    </div>
  );
}

function ManagedDepartmentRow({
  canManage,
  companyName,
  department,
  departments,
  parentName,
}: {
  canManage: boolean;
  companyName: string;
  department: DepartmentOption;
  departments: DepartmentOption[];
  parentName: string | null | undefined;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const companyRootAreas = departments.filter(
    (option) =>
      option.company_id === department.company_id &&
      !option.parent_department_id &&
      option.id !== department.id
  );

  if (isEditing) {
    return (
      <div className="rounded-xl border border-border/70 p-3">
        <form
          action={updatePlatformDepartmentAction}
          className="grid gap-3"
        >
          <input name="departmentId" type="hidden" value={department.id} />
          <Field htmlFor={`department-name-${department.id}`} label="Nombre">
            <Input
              defaultValue={department.name}
              id={`department-name-${department.id}`}
              maxLength={120}
              name="departmentName"
              required
            />
          </Field>
          <Field
            htmlFor={`department-parent-${department.id}`}
            label="Area padre"
          >
            <select
              className={SELECT_CLASSNAME}
              defaultValue={department.parent_department_id ?? ""}
              id={`department-parent-${department.id}`}
              name="parentDepartmentId"
            >
              <option value="">Area raiz</option>
              {companyRootAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit">
              <Check className="size-4" />
              Guardar
            </Button>
            <Button
              onClick={() => setIsEditing(false)}
              size="sm"
              type="button"
              variant="outline"
            >
              <X className="size-4" />
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{department.name}</p>
        <p className="text-xs text-muted-foreground">
          {companyName} - {parentName ?? "Area raiz"}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Badge variant="outline">
          {department.is_assignable ? "Operativo" : "Area"}
        </Badge>
        {canManage ? (
          <>
            <Button
              onClick={() => setIsEditing(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Pencil className="size-4" />
              Editar
            </Button>
            <ConfirmDeleteForm
              action={deletePlatformDepartmentAction}
              confirmMessage={`Eliminar "${department.name}"? Esta accion no se puede deshacer.`}
              hiddenName="departmentId"
              hiddenValue={department.id}
            >
              <Button size="sm" type="submit" variant="destructive">
                <Trash2 className="size-4" />
                Eliminar
              </Button>
            </ConfirmDeleteForm>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ManagedJobPositionsList({
  canManage,
  departments,
  jobPositions,
}: {
  canManage: boolean;
  departments: DepartmentOption[];
  jobPositions: JobPositionOption[];
}) {
  const departmentMap = useMemo(
    () =>
      new Map(departments.map((department) => [department.id, department])),
    [departments]
  );

  if (jobPositions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/80 px-3 py-6 text-center text-sm text-muted-foreground">
        Sin puestos todavia.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {jobPositions.map((position) => (
        <ManagedJobPositionRow
          canManage={canManage}
          department={departmentMap.get(position.department_id) ?? null}
          departments={departments}
          key={position.id}
          position={position}
        />
      ))}
    </div>
  );
}

function ManagedJobPositionRow({
  canManage,
  department,
  departments,
  position,
}: {
  canManage: boolean;
  department: DepartmentOption | null;
  departments: DepartmentOption[];
  position: JobPositionOption;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const companyDepartments = departments.filter(
    (option) =>
      option.company_id === position.company_id && option.is_assignable
  );

  if (isEditing) {
    return (
      <div className="rounded-xl border border-border/70 p-3">
        <form
          action={updatePlatformJobPositionAction}
          className="grid gap-3"
        >
          <input name="jobPositionId" type="hidden" value={position.id} />
          <Field htmlFor={`position-name-${position.id}`} label="Nombre">
            <Input
              defaultValue={position.name}
              id={`position-name-${position.id}`}
              maxLength={120}
              name="jobPositionName"
              required
            />
          </Field>
          <Field htmlFor={`position-code-${position.id}`} label="Codigo">
            <Input
              defaultValue={position.code ?? ""}
              id={`position-code-${position.id}`}
              maxLength={64}
              name="jobPositionCode"
            />
          </Field>
          <Field
            htmlFor={`position-department-${position.id}`}
            label="Departamento"
          >
            <select
              className={SELECT_CLASSNAME}
              defaultValue={position.department_id}
              id={`position-department-${position.id}`}
              name="departmentId"
              required
            >
              {companyDepartments.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
          <Field htmlFor={`position-active-${position.id}`} label="Estado">
            <select
              className={SELECT_CLASSNAME}
              defaultValue={position.active ? "true" : "false"}
              id={`position-active-${position.id}`}
              name="jobPositionActive"
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit">
              <Check className="size-4" />
              Guardar
            </Button>
            <Button
              onClick={() => setIsEditing(false)}
              size="sm"
              type="button"
              variant="outline"
            >
              <X className="size-4" />
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{position.name}</p>
        <p className="text-xs text-muted-foreground">
          {department?.name ?? "Sin depto"}
          {position.code ? ` - ${position.code}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Badge variant="outline">{position.active ? "Activo" : "Inactivo"}</Badge>
        {canManage ? (
          <>
            <Button
              onClick={() => setIsEditing(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Pencil className="size-4" />
              Editar
            </Button>
            <ConfirmDeleteForm
              action={deletePlatformJobPositionAction}
              confirmMessage={`Eliminar "${position.name}"? Esta accion no se puede deshacer.`}
              hiddenName="jobPositionId"
              hiddenValue={position.id}
            >
              <Button size="sm" type="submit" variant="destructive">
                <Trash2 className="size-4" />
                Eliminar
              </Button>
            </ConfirmDeleteForm>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ManagedScheduleConfigsList({
  areas,
  canManage,
  companies,
  scheduleConfigs,
}: {
  areas: DepartmentOption[];
  canManage: boolean;
  companies: CompanyOption[];
  scheduleConfigs: ScheduleConfigOption[];
}) {
  const companyMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies]
  );
  const configMap = useMemo(
    () =>
      new Map(
        scheduleConfigs.map((config) => [config.department_id, config])
      ),
    [scheduleConfigs]
  );

  if (areas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/80 px-3 py-6 text-center text-sm text-muted-foreground">
        Sin areas configurables.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {areas.map((area) => {
        const config = configMap.get(area.id);

        return (
          <div
            className="grid grid-cols-1 gap-3 rounded-2xl border border-border/70 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,360px)_auto] lg:items-end"
            key={area.id}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{area.name}</p>
              <p className="text-sm text-muted-foreground">
                {companyMap.get(area.company_id)?.name ?? "Sin empresa"} - Actual:{" "}
                {scheduleTypeLabel(config?.schedule_type)}
              </p>
            </div>
            <form
              action={updatePlatformScheduleConfigAction}
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            >
              <input name="departmentId" type="hidden" value={area.id} />
              <Field htmlFor={`schedule-type-${area.id}`} label="Tipo">
                <select
                  className={SELECT_CLASSNAME}
                  defaultValue={config?.schedule_type ?? "3t5"}
                  disabled={!canManage}
                  id={`schedule-type-${area.id}`}
                  name="scheduleType"
                >
                  <option value="3t5">3 turnos / 5 grupos</option>
                  <option value="jornada_normal">Jornada normal</option>
                </select>
              </Field>
              <Button disabled={!canManage} type="submit" variant="outline">
                {config ? "Guardar" : "Crear"}
              </Button>
            </form>
            {config && canManage ? (
              <ConfirmDeleteForm
                action={deletePlatformScheduleConfigAction}
                confirmMessage={`Eliminar la configuracion de "${area.name}"? El area quedara sin tipo de turno explicito.`}
                hiddenName="departmentId"
                hiddenValue={area.id}
              >
                <Button type="submit" variant="destructive">
                  <Trash2 className="size-4" />
                  Eliminar
                </Button>
              </ConfirmDeleteForm>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
