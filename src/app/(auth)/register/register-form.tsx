"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getOperationalDepartmentsForArea,
  getTopLevelDepartmentsForCompany,
} from "@/lib/departments";
import { FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import { registerEmployee } from "./actions";
import type { Company, Department } from "@/types";

interface RegisterFormProps {
  companies: Company[];
  departments: Department[];
}

export default function RegisterForm({
  companies,
  departments,
}: RegisterFormProps) {
  function getInitialAreaId(companyValue: string) {
    return getTopLevelDepartmentsForCompany(departments, companyValue)[0]?.id ?? "";
  }

  function getInitialDepartmentId(companyValue: string, areaValue: string) {
    return (
      getOperationalDepartmentsForArea(departments, companyValue, areaValue)[0]?.id ??
      ""
    );
  }

  const initialCompanyId = companies[0]?.id ?? "";
  const initialAreaDepartmentId = getInitialAreaId(initialCompanyId);
  const initialDepartmentId = getInitialDepartmentId(
    initialCompanyId,
    initialAreaDepartmentId
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [areaDepartmentId, setAreaDepartmentId] = useState(initialAreaDepartmentId);
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);
  const [employeeId, setEmployeeId] = useState("");
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableAreas = getTopLevelDepartmentsForCompany(departments, companyId);
  const availableDepartments = getOperationalDepartmentsForArea(
    departments,
    companyId,
    areaDepartmentId
  );

  function handleCompanyChange(companyValue: string) {
    setCompanyId(companyValue);

    const nextAreaDepartmentId = getInitialAreaId(companyValue);
    const nextDepartmentId = getInitialDepartmentId(
      companyValue,
      nextAreaDepartmentId
    );

    setAreaDepartmentId(nextAreaDepartmentId);
    setDepartmentId(nextDepartmentId);
  }

  function handleAreaChange(nextAreaDepartmentId: string) {
    setAreaDepartmentId(nextAreaDepartmentId);
    setDepartmentId(getInitialDepartmentId(companyId, nextAreaDepartmentId));
  }

  function handleIdCardChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen del carne no puede superar los 5 MB.");
      event.target.value = "";
      return;
    }

    setError(null);
    setIdCardFile(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCaptchaError(null);

    if (!idCardFile) {
      setError("La foto del carne es obligatoria.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.set("full_name", fullName.trim());
    formData.set("email", email.trim());
    formData.set("password", password);
    formData.set("company_id", companyId);
    formData.set("area_department_id", areaDepartmentId);
    formData.set("department_id", departmentId);
    formData.set("employee_id", employeeId.trim());
    formData.set("id_card", idCardFile);
    formData.set("captcha_token", captchaToken);

    const result = await registerEmployee(formData);
    setLoading(false);

    if (result.error) {
      if (result.error.toLowerCase().includes("anti-bot")) {
        setCaptchaError(result.error);
      } else {
        setError(result.error);
      }
      return;
    }

    setRegistered(true);
  }

  if (registered) {
    return (
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Solicitud enviada</CardTitle>
          <CardDescription>
            Tu cuenta se ha creado correctamente y ha quedado pendiente de
            validacion manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            Un administrador revisara tu documentacion y activara la cuenta
            cuando confirme tus datos de empleado.
          </p>
          <p>
            Hasta entonces no podras acceder al dashboard. En cuanto se apruebe,
            podras iniciar sesion con tu email y contrasena.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button asChild className="w-full">
            <Link href="/login">Ir a iniciar sesion</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Necesitas crear otra cuenta?{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setRegistered(false);
                setFullName("");
                setEmail("");
                setPassword("");
                setEmployeeId("");
                setCompanyId(initialCompanyId);
                setAreaDepartmentId(initialAreaDepartmentId);
                setDepartmentId(initialDepartmentId);
                setIdCardFile(null);
                setCaptchaToken("");
                setCaptchaError(null);
                setError(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            >
              Volver al formulario
            </button>
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-border/80">
        <CardHeader className="space-y-3">
          <div className="space-y-2">
            <CardTitle>Crear cuenta</CardTitle>
            <CardDescription>
              Introduce tus datos laborales, elige primero tu area de trabajo y
              despues tu departamento operativo para solicitar acceso.
            </CardDescription>
          </div>
        </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {error && (
            <p className="rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input
              id="full_name"
              type="text"
              placeholder="Tu nombre"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email corporativo</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="company_id">Empresa</Label>
              <select
                id="company_id"
                value={companyId}
                onChange={(event) => handleCompanyChange(event.target.value)}
                required
                disabled={companies.length === 0}
                className={FORM_CONTROL_CLASSNAME}
              >
                {companies.length === 0 && (
                  <option value="">Sin empresas disponibles</option>
                )}
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="area_department_id">Area o taller</Label>
              <select
                id="area_department_id"
                value={areaDepartmentId}
                onChange={(event) => handleAreaChange(event.target.value)}
                required
                disabled={availableAreas.length === 0}
                className={FORM_CONTROL_CLASSNAME}
              >
                {availableAreas.length === 0 && (
                  <option value="">Sin areas disponibles</option>
                )}
                {availableAreas.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <p className="text-sm leading-6 text-muted-foreground">
                Selecciona primero tu taller o area general dentro de la empresa.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department_id">Departamento operativo</Label>
              <select
                id="department_id"
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                required
                disabled={availableDepartments.length === 0}
                className={FORM_CONTROL_CLASSNAME}
              >
                {availableDepartments.length === 0 && (
                  <option value="">Sin departamentos operativos disponibles</option>
                )}
                {availableDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <p className="text-sm leading-6 text-muted-foreground">
                Solo puedes registrarte en un departamento operativo final, no en un
                nivel padre.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee_id">ID de empleado</Label>
            <Input
              id="employee_id"
              name="employee_id"
              type="text"
              placeholder="Tu identificador interno"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="id_card">Carne de empresa</Label>
            <Input
              ref={fileInputRef}
              id="id_card"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              required
              onChange={handleIdCardChange}
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Sube una foto del carne corporativo. Solo la revisara el equipo
              administrador y se borrara al aprobar o rechazar tu cuenta.
            </p>
            {idCardFile && (
              <p className="text-sm font-medium text-foreground">
                Archivo seleccionado: {idCardFile.name}
              </p>
            )}
          </div>

          <TurnstileField
            error={captchaError}
            onTokenChange={(token) => {
              setCaptchaToken(token);
              if (token) {
                setCaptchaError(null);
              }
            }}
          />
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={
              loading ||
              companies.length === 0 ||
              availableAreas.length === 0 ||
              availableDepartments.length === 0
            }
          >
            {loading ? "Enviando solicitud..." : "Solicitar acceso"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Inicia sesion
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
