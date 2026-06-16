"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface CompanyOption {
  id: string;
  name: string;
}

interface DepartmentOption {
  id: string;
  company_id: string;
  name: string;
}

interface JobPositionOption {
  id: string;
  active: boolean;
  company_id: string;
  department_id: string;
  name: string;
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

export function ConsoleCompanyAreaFields({
  areas,
  companies,
  idPrefix,
}: {
  areas: DepartmentOption[];
  companies: CompanyOption[];
  idPrefix: string;
}) {
  const [companyId, setCompanyId] = useState("");
  const filteredAreas = useMemo(
    () => areas.filter((area) => area.company_id === companyId),
    [areas, companyId],
  );

  return (
    <>
      <Field htmlFor={`${idPrefix}-company`} label="Empresa">
        <select
          className={SELECT_CLASSNAME}
          id={`${idPrefix}-company`}
          name="companyId"
          onChange={(event) => setCompanyId(event.target.value)}
          required
          value={companyId}
        >
          <option value="">Selecciona empresa</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </Field>

      <Field htmlFor={`${idPrefix}-parent-department`} label="Area padre opcional">
        <select
          key={companyId || "no-company"}
          className={SELECT_CLASSNAME}
          disabled={!companyId}
          id={`${idPrefix}-parent-department`}
          name="parentDepartmentId"
        >
          <option value="">
            {companyId
              ? "Crear area raiz en esta empresa"
              : "Selecciona empresa primero"}
          </option>
          {filteredAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

export function ConsoleCompanyDepartmentFields({
  companies,
  departments,
  departmentLabel = "Departamento operativo",
  idPrefix,
  jobPositionLabel = "Puesto",
  jobPositions,
}: {
  companies: CompanyOption[];
  departments: DepartmentOption[];
  departmentLabel?: string;
  idPrefix: string;
  jobPositionLabel?: string;
  jobPositions?: JobPositionOption[];
}) {
  const [companyId, setCompanyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [jobPositionId, setJobPositionId] = useState("");

  const filteredDepartments = useMemo(
    () =>
      departments.filter((department) => department.company_id === companyId),
    [companyId, departments],
  );
  const filteredJobPositions = useMemo(
    () =>
      (jobPositions ?? []).filter(
        (position) =>
          position.active &&
          position.company_id === companyId &&
          position.department_id === departmentId,
      ),
    [companyId, departmentId, jobPositions],
  );

  function handleCompanyChange(nextCompanyId: string) {
    setCompanyId(nextCompanyId);
    setDepartmentId("");
    setJobPositionId("");
  }

  function handleDepartmentChange(nextDepartmentId: string) {
    setDepartmentId(nextDepartmentId);
    setJobPositionId("");
  }

  return (
    <>
      <Field htmlFor={`${idPrefix}-company`} label="Empresa">
        <select
          className={SELECT_CLASSNAME}
          id={`${idPrefix}-company`}
          name="companyId"
          onChange={(event) => handleCompanyChange(event.target.value)}
          required
          value={companyId}
        >
          <option value="">Selecciona empresa</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </Field>

      <Field htmlFor={`${idPrefix}-department`} label={departmentLabel}>
        <select
          key={companyId || "no-company"}
          className={SELECT_CLASSNAME}
          disabled={!companyId}
          id={`${idPrefix}-department`}
          name="departmentId"
          onChange={(event) => handleDepartmentChange(event.target.value)}
          required
          value={departmentId}
        >
          <option value="">
            {!companyId
              ? "Selecciona empresa primero"
              : filteredDepartments.length === 0
                ? "Sin departamentos disponibles"
                : "Selecciona departamento"}
          </option>
          {filteredDepartments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </Field>

      {jobPositions ? (
        <Field htmlFor={`${idPrefix}-job-position`} label={jobPositionLabel}>
          <select
            key={departmentId || "no-department"}
            className={SELECT_CLASSNAME}
            disabled={!departmentId}
            id={`${idPrefix}-job-position`}
            name="jobPositionId"
            onChange={(event) => setJobPositionId(event.target.value)}
            value={jobPositionId}
          >
            <option value="">
              {departmentId ? "Sin puesto" : "Selecciona departamento primero"}
            </option>
            {filteredJobPositions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
    </>
  );
}
