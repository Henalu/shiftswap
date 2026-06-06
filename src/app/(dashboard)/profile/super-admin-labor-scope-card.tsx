"use client";

import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Loader2,
  Pencil,
  ShieldCheck,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  getDepartmentArea,
  getDepartmentById,
  getOperationalDepartmentsForArea,
  getTopLevelDepartmentsForCompany,
  isOperationalDepartment,
} from "@/lib/departments";
import { FORM_CONTROL_CLASSNAME, PANEL_CLASSNAME, cn } from "@/lib/utils";
import type { Company, Department } from "@/types";
import { updateSuperAdminLaborScope } from "./actions";

interface ScopeFieldProps {
  controlId: string;
  editControl: ReactNode;
  icon: ReactNode;
  isEditing: boolean;
  label: string;
  value: string;
}

interface SuperAdminLaborScopeCardProps {
  companies: Pick<Company, "id" | "name">[];
  departments: Department[];
  currentCompanyId: string | null;
  currentDepartmentId: string | null;
  currentCompanyName: string;
  currentAreaName: string;
  currentDepartmentName: string;
}

function ScopeField({
  controlId,
  editControl,
  icon,
  isEditing,
  label,
  value,
}: ScopeFieldProps) {
  return (
    <div
      className={cn(
        PANEL_CLASSNAME,
        "flex min-w-0 items-start gap-3 px-4 py-4 transition-colors",
        isEditing && "bg-secondary/20"
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {isEditing ? (
          <Label
            htmlFor={controlId}
            className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            {label}
          </Label>
        ) : (
          <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
        )}
        {isEditing ? (
          editControl
        ) : (
          <span className="block break-words text-sm font-medium text-foreground">
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

function getSelectionForCompany({
  departments,
  companyId,
  preferredDepartmentId,
}: {
  departments: Department[];
  companyId: string;
  preferredDepartmentId?: string | null;
}) {
  const areas = getTopLevelDepartmentsForCompany(departments, companyId);
  const preferredDepartment = getDepartmentById(
    departments,
    preferredDepartmentId
  );
  const preferredArea = getDepartmentArea(departments, preferredDepartmentId);

  if (
    preferredDepartment &&
    preferredArea &&
    preferredDepartment.company_id === companyId &&
    preferredArea.company_id === companyId &&
    isOperationalDepartment(preferredDepartment, departments)
  ) {
    return {
      areaDepartmentId: preferredArea.id,
      departmentId: preferredDepartment.id,
    };
  }

  const firstArea = areas[0];
  const firstDepartment = firstArea
    ? getOperationalDepartmentsForArea(departments, companyId, firstArea.id)[0]
    : null;

  return {
    areaDepartmentId: firstArea?.id ?? "",
    departmentId: firstDepartment?.id ?? "",
  };
}

export function SuperAdminLaborScopeCard({
  companies,
  departments,
  currentCompanyId,
  currentDepartmentId,
  currentCompanyName,
  currentAreaName,
  currentDepartmentName,
}: SuperAdminLaborScopeCardProps) {
  const router = useRouter();
  const initialCompanyId = currentCompanyId ?? companies[0]?.id ?? "";
  const initialSelection = getSelectionForCompany({
    departments,
    companyId: initialCompanyId,
    preferredDepartmentId: currentDepartmentId,
  });

  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [areaDepartmentId, setAreaDepartmentId] = useState(
    initialSelection.areaDepartmentId
  );
  const [departmentId, setDepartmentId] = useState(
    initialSelection.departmentId
  );
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const availableAreas = getTopLevelDepartmentsForCompany(
    departments,
    companyId
  );
  const availableDepartments = getOperationalDepartmentsForArea(
    departments,
    companyId,
    areaDepartmentId
  );
  const selectedCompany =
    companies.find((company) => company.id === companyId) ?? null;
  const selectedArea = getDepartmentById(departments, areaDepartmentId);
  const selectedDepartment = getDepartmentById(departments, departmentId);
  const hasChanges =
    companyId !== initialCompanyId ||
    areaDepartmentId !== initialSelection.areaDepartmentId ||
    departmentId !== initialSelection.departmentId;
  const canSave = Boolean(companyId && areaDepartmentId && departmentId);

  function resetForm() {
    setCompanyId(initialCompanyId);
    setAreaDepartmentId(initialSelection.areaDepartmentId);
    setDepartmentId(initialSelection.departmentId);
  }

  function handleCancelEdit() {
    resetForm();
    setIsEditing(false);
  }

  function handleCompanyChange(nextCompanyId: string) {
    const nextSelection = getSelectionForCompany({
      departments,
      companyId: nextCompanyId,
      preferredDepartmentId: null,
    });

    setCompanyId(nextCompanyId);
    setAreaDepartmentId(nextSelection.areaDepartmentId);
    setDepartmentId(nextSelection.departmentId);
  }

  function handleAreaChange(nextAreaDepartmentId: string) {
    const nextDepartment =
      getOperationalDepartmentsForArea(
        departments,
        companyId,
        nextAreaDepartmentId
      )[0]?.id ?? "";

    setAreaDepartmentId(nextAreaDepartmentId);
    setDepartmentId(nextDepartment);
  }

  async function handleSave() {
    if (!canSave || !hasChanges) {
      return;
    }

    setSaving(true);

    const formData = new FormData();
    formData.set("company_id", companyId);
    formData.set("area_department_id", areaDepartmentId);
    formData.set("department_id", departmentId);

    const result = await updateSuperAdminLaborScope(formData);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Asignacion laboral actualizada.");
    setIsEditing(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle>Asignacion laboral de super admin</CardTitle>
            <CardDescription>
              Para publicar turnos tambien necesitas actuar desde un
              departamento operativo concreto. Este cambio se aplica al instante.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="w-fit border-sky-500/15 bg-sky-500/10 text-sky-700">
              <ShieldCheck className="size-3.5" />
              Permiso directo
            </Badge>
            {!isEditing ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <ScopeField
            controlId="super-admin-company"
            editControl={
              <select
                id="super-admin-company"
                value={companyId}
                onChange={(event) => handleCompanyChange(event.target.value)}
                disabled={saving || companies.length === 0}
                className={FORM_CONTROL_CLASSNAME}
              >
                {companies.length === 0 ? (
                  <option value="">Sin empresas disponibles</option>
                ) : null}
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            }
            icon={<Building2 className="size-4" />}
            isEditing={isEditing}
            label="Empresa"
            value={selectedCompany?.name ?? currentCompanyName}
          />
          <ScopeField
            controlId="super-admin-area"
            editControl={
              <select
                id="super-admin-area"
                value={areaDepartmentId}
                onChange={(event) => handleAreaChange(event.target.value)}
                disabled={saving || availableAreas.length === 0}
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
            }
            icon={<Workflow className="size-4" />}
            isEditing={isEditing}
            label="Area o taller"
            value={selectedArea?.name ?? currentAreaName}
          />
          <ScopeField
            controlId="super-admin-department"
            editControl={
              <select
                id="super-admin-department"
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                disabled={saving || availableDepartments.length === 0}
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
            }
            icon={<Workflow className="size-4" />}
            isEditing={isEditing}
            label="Departamento operativo"
            value={selectedDepartment?.name ?? currentDepartmentName}
          />
        </div>
      </CardContent>
      {isEditing ? (
        <CardFooter className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-muted-foreground">
            Al cambiar de departamento se limpia el puesto de trabajo asignado
            para evitar datos cruzados entre areas.
          </p>
          <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              <X className="size-4" />
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!canSave || !hasChanges || saving}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {saving ? "Guardando..." : "Guardar asignacion"}
            </Button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
