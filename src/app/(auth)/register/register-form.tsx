"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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
  const initialCompanyId = companies[0]?.id ?? "";
  const initialDepartmentId =
    departments.find((department) => department.company_id === initialCompanyId)
      ?.id ?? "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);
  const [employeeId, setEmployeeId] = useState("");
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableDepartments = departments.filter(
    (department) => department.company_id === companyId
  );

  function handleCompanyChange(companyValue: string) {
    setCompanyId(companyValue);

    const nextDepartmentId =
      departments.find((department) => department.company_id === companyValue)?.id ??
      "";

    setDepartmentId(nextDepartmentId);
  }

  function handleIdCardChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen del carné no puede superar los 5 MB.");
      event.target.value = "";
      return;
    }

    setError(null);
    setIdCardFile(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!idCardFile) {
      setError("La foto del carné es obligatoria.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.set("full_name", fullName.trim());
    formData.set("email", email.trim());
    formData.set("password", password);
    formData.set("company_id", companyId);
    formData.set("department_id", departmentId);
    formData.set("employee_id", employeeId.trim());
    formData.set("id_card", idCardFile);

    const result = await registerEmployee(formData);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setRegistered(true);
  }

  if (registered) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Solicitud enviada</CardTitle>
          <CardDescription>
            Tu cuenta se ha creado correctamente y ha quedado pendiente de
            validación manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Un administrador revisará tu carné y activará la cuenta cuando
            confirme tus datos de empleado.
          </p>
          <p>
            Hasta entonces no podrás acceder al dashboard. Cuando la cuenta sea
            aprobada ya podrás iniciar sesión con tu email y contraseña.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button asChild className="w-full">
            <Link href="/login">Ir a iniciar sesión</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿Necesitas crear otra cuenta?{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setRegistered(false);
                setFullName("");
                setEmail("");
                setPassword("");
                setEmployeeId("");
                setIdCardFile(null);
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
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>
          Introduce tus datos y la evidencia de empleado para solicitar acceso.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive" role="alert">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_id">Empresa</Label>
              <select
                id="company_id"
                value={companyId}
                onChange={(event) => handleCompanyChange(event.target.value)}
                required
                disabled={companies.length === 0}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none ring-ring/50 transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
              <Label htmlFor="department_id">Departamento</Label>
              <select
                id="department_id"
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                required
                disabled={availableDepartments.length === 0}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none ring-ring/50 transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              >
                {availableDepartments.length === 0 && (
                  <option value="">Sin departamentos disponibles</option>
                )}
                {availableDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee_id">ID de empleado</Label>
            <Input
              id="employee_id"
              type="text"
              placeholder="Tu identificador interno"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="id_card">Carné de empresa</Label>
            <Input
              ref={fileInputRef}
              id="id_card"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              required
              onChange={handleIdCardChange}
            />
            <p className="text-xs text-muted-foreground">
              Sube una foto del carné corporativo. Solo la revisará el equipo
              administrador y se borrará al aprobar o rechazar tu cuenta.
            </p>
            {idCardFile && (
              <p className="text-xs text-foreground">
                Archivo seleccionado: {idCardFile.name}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={
              loading ||
              companies.length === 0 ||
              availableDepartments.length === 0
            }
          >
            {loading ? "Enviando solicitud..." : "Registrarse"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Inicia sesión
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
