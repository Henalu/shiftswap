"use client";

import { useMemo, useState } from "react";
import {
  CUSTOM_JOB_POSITION_INPUT_PATTERN,
  CUSTOM_JOB_POSITION_MAX_LENGTH,
  CUSTOM_JOB_POSITION_MIN_LENGTH,
  getCustomJobPositionNameError,
  normalizeCustomJobPositionName,
} from "@/lib/custom-job-position";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

const OTHER_JOB_POSITION_VALUE = "__other__";

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
  const [customJobPositionName, setCustomJobPositionName] = useState("");

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
  const isCustomJobPosition = jobPositionId === OTHER_JOB_POSITION_VALUE;
  const normalizedCustomJobPositionName = normalizeCustomJobPositionName(
    customJobPositionName,
  );
  const customJobPositionError =
    isCustomJobPosition && customJobPositionName
      ? getCustomJobPositionNameError(customJobPositionName)
      : null;
  const summaryJobPositionName =
    selectedJobPosition?.name ??
    (isCustomJobPosition && normalizedCustomJobPositionName
      ? normalizedCustomJobPositionName
      : null);

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
    setCustomJobPositionName("");
  }

  function handleDepartmentChange(nextDepartmentId: string) {
    setDepartmentId(nextDepartmentId);
    setJobPositionId("");
    setCustomJobPositionName("");
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
          {selectedJobPosition ? (
            <input
              type="hidden"
              name="job_position_id"
              value={selectedJobPosition.id}
            />
          ) : null}
          <select
            id={`${idPrefix}-job-position`}
            value={jobPositionId}
            onChange={(event) => {
              const nextValue = event.target.value;
              setJobPositionId(nextValue);

              if (nextValue !== OTHER_JOB_POSITION_VALUE) {
                setCustomJobPositionName("");
              }
            }}
            disabled={!departmentId}
            className={FORM_CONTROL_CLASSNAME}
          >
            <option value="">Sin puesto especifico</option>
            {availableJobPositions.map((jobPosition) => (
              <option key={jobPosition.id} value={jobPosition.id}>
                {jobPosition.name}
              </option>
            ))}
            <option value={OTHER_JOB_POSITION_VALUE}>Otro</option>
          </select>
        </div>

        {isCustomJobPosition ? (
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor={`${idPrefix}-custom-job-position`}>
              Nombre del puesto
            </Label>
            <Input
              id={`${idPrefix}-custom-job-position`}
              name="custom_job_position_name"
              value={customJobPositionName}
              onChange={(event) => setCustomJobPositionName(event.target.value)}
              onBlur={() =>
                setCustomJobPositionName(normalizedCustomJobPositionName)
              }
              required
              minLength={CUSTOM_JOB_POSITION_MIN_LENGTH}
              maxLength={CUSTOM_JOB_POSITION_MAX_LENGTH}
              pattern={CUSTOM_JOB_POSITION_INPUT_PATTERN}
              placeholder="Ej. Gruista"
              aria-invalid={Boolean(customJobPositionError)}
              aria-describedby={`${idPrefix}-custom-job-position-help`}
            />
            <p
              id={`${idPrefix}-custom-job-position-help`}
              className={cn(
                "text-xs leading-5",
                customJobPositionError
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {customJobPositionError ??
                "Solo letras y espacios. Usa un nombre profesional del puesto."}
            </p>
          </div>
        ) : null}
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
        {summaryJobPositionName ? (
          <>
            {" "}
            para el puesto{" "}
            <span className="font-semibold text-foreground">
              {summaryJobPositionName}
            </span>
          </>
        ) : isCustomJobPosition ? (
          " para otro puesto"
        ) : (
          " sin puesto especifico"
        )}
        .
      </p>
    </div>
  );
}
