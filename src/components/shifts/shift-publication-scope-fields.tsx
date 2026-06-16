"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  getDepartmentArea,
  getDepartmentById,
  getOperationalDepartmentsForArea,
  getTopLevelDepartmentsForCompany,
} from "@/lib/departments";
import { FORM_CONTROL_CLASSNAME, cn } from "@/lib/utils";
import type { Department, JobPosition } from "@/types";

interface ShiftPublicationScopeFieldsProps {
  departments: Department[];
  jobPositions: JobPosition[];
  defaultDepartmentId: string;
  defaultJobPositionId?: string | null;
  idPrefix: string;
  className?: string;
  summaryPrefix?: string;
}

function getCompanyId(departments: Department[], departmentId: string) {
  return (
    departments.find((department) => department.id === departmentId)?.company_id ??
    departments[0]?.company_id ??
    ""
  );
}

function getInitialAreaId(
  departments: Department[],
  companyId: string,
  defaultDepartmentId: string,
) {
  const currentArea = getDepartmentArea(departments, defaultDepartmentId);
  if (currentArea?.company_id === companyId) {
    return currentArea.id;
  }

  return getTopLevelDepartmentsForCompany(departments, companyId)[0]?.id ?? "";
}

function getInitialDepartmentId(
  departments: Department[],
  companyId: string,
  areaDepartmentId: string,
  defaultDepartmentId: string,
) {
  const availableDepartments = getOperationalDepartmentsForArea(
    departments,
    companyId,
    areaDepartmentId,
  );

  if (
    availableDepartments.some(
      (department) => department.id === defaultDepartmentId,
    )
  ) {
    return defaultDepartmentId;
  }

  return availableDepartments[0]?.id ?? "";
}

function getInitialJobPositionId(
  jobPositions: JobPosition[],
  departmentId: string,
  defaultJobPositionId: string | null | undefined,
) {
  if (
    defaultJobPositionId &&
    jobPositions.some(
      (jobPosition) =>
        jobPosition.id === defaultJobPositionId &&
        jobPosition.active &&
        jobPosition.department_id === departmentId,
    )
  ) {
    return defaultJobPositionId;
  }

  return "";
}

export function ShiftPublicationScopeFields({
  departments,
  jobPositions,
  defaultDepartmentId,
  defaultJobPositionId = null,
  idPrefix,
  className,
  summaryPrefix = "Este turno se publicara",
}: ShiftPublicationScopeFieldsProps) {
  const companyId = useMemo(
    () => getCompanyId(departments, defaultDepartmentId),
    [defaultDepartmentId, departments],
  );
  const initialAreaId = useMemo(
    () => getInitialAreaId(departments, companyId, defaultDepartmentId),
    [companyId, defaultDepartmentId, departments],
  );
  const initialDepartmentId = useMemo(
    () =>
      getInitialDepartmentId(
        departments,
        companyId,
        initialAreaId,
        defaultDepartmentId,
      ),
    [companyId, defaultDepartmentId, departments, initialAreaId],
  );
  const [areaDepartmentId, setAreaDepartmentId] = useState(initialAreaId);
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);
  const [jobPositionId, setJobPositionId] = useState(() =>
    getInitialJobPositionId(
      jobPositions,
      initialDepartmentId,
      defaultJobPositionId,
    ),
  );

  const availableAreas = useMemo(
    () => getTopLevelDepartmentsForCompany(departments, companyId),
    [companyId, departments],
  );
  const availableDepartments = useMemo(
    () =>
      getOperationalDepartmentsForArea(
        departments,
        companyId,
        areaDepartmentId,
      ),
    [areaDepartmentId, companyId, departments],
  );
  const availableJobPositions = useMemo(
    () =>
      jobPositions.filter(
        (jobPosition) =>
          jobPosition.active && jobPosition.department_id === departmentId,
      ),
    [departmentId, jobPositions],
  );
  const selectedDepartment = getDepartmentById(departments, departmentId);
  const selectedArea = getDepartmentArea(departments, departmentId);
  const selectedJobPosition =
    availableJobPositions.find(
      (jobPosition) => jobPosition.id === jobPositionId,
    ) ?? null;

  function handleAreaChange(nextAreaDepartmentId: string) {
    const nextDepartments = getOperationalDepartmentsForArea(
      departments,
      companyId,
      nextAreaDepartmentId,
    );
    const nextDepartmentId = nextDepartments[0]?.id ?? "";

    setAreaDepartmentId(nextAreaDepartmentId);
    setDepartmentId(nextDepartmentId);
    setJobPositionId("");
  }

  function handleDepartmentChange(nextDepartmentId: string) {
    setDepartmentId(nextDepartmentId);
    setJobPositionId("");
  }

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-border/70 bg-secondary/35 px-4 py-4",
        className,
      )}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-area-department`}>Area o taller</Label>
          <select
            id={`${idPrefix}-area-department`}
            value={areaDepartmentId}
            onChange={(event) => handleAreaChange(event.target.value)}
            disabled={availableAreas.length === 0}
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
          <Label htmlFor={`${idPrefix}-department`}>
            Departamento operativo
          </Label>
          <select
            id={`${idPrefix}-department`}
            name="department_id"
            value={departmentId}
            onChange={(event) => handleDepartmentChange(event.target.value)}
            required
            disabled={availableDepartments.length === 0}
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
          <Label htmlFor={`${idPrefix}-job-position`}>Puesto de trabajo</Label>
          <select
            id={`${idPrefix}-job-position`}
            name="job_position_id"
            value={jobPositionId}
            onChange={(event) => setJobPositionId(event.target.value)}
            disabled={availableJobPositions.length === 0}
            className={FORM_CONTROL_CLASSNAME}
          >
            <option value="">
              {availableJobPositions.length === 0
                ? "Sin puestos disponibles"
                : "Sin puesto especifico"}
            </option>
            {availableJobPositions.map((jobPosition) => (
              <option key={jobPosition.id} value={jobPosition.id}>
                {jobPosition.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm leading-6 text-muted-foreground">
        {summaryPrefix} en{" "}
        <span className="font-semibold text-foreground">
          {selectedDepartment?.name ?? "un departamento operativo"}
        </span>
        {selectedArea && selectedArea.id !== selectedDepartment?.id ? (
          <>
            {" "}
            dentro del area{" "}
            <span className="font-semibold text-foreground">
              {selectedArea.name}
            </span>
          </>
        ) : null}
        {selectedJobPosition ? (
          <>
            {" "}
            para el puesto{" "}
            <span className="font-semibold text-foreground">
              {selectedJobPosition.name}
            </span>
          </>
        ) : (
          " sin puesto especifico"
        )}
        .
      </p>
    </div>
  );
}
