import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  CalendarCog,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Palette,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ColorPaletteField } from "@/components/ui/color-palette-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCompanyThemeAccentColor } from "@/lib/company-theme";
import {
  createPlatformCompanyAction,
  createPlatformDepartmentAction,
  createPlatformJobPositionAction,
  createPlatformUserAction,
  resetPlatformUserPasswordAction,
  updatePlatformCompanyThemeAction,
  updatePlatformScheduleConfigAction,
} from "@/lib/platform-console-actions";
import {
  canManagePlatform,
  canOperatePlatformUsers,
  getCurrentPlatformAccess,
  PLATFORM_ROLE_LABELS,
} from "@/lib/platform-console";
import { createAdminClient } from "@/lib/supabase/admin";
import { USER_ROLE_LABELS } from "@/lib/user-roles";
import { cn } from "@/lib/utils";
import type { UserRole, ValidationStatus } from "@/types";

export const dynamic = "force-dynamic";

interface ConsolePageProps {
  searchParams: Promise<{
    error?: string;
    status?: string;
  }>;
}

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  theme_config: Record<string, unknown> | null;
  created_at: string;
}

interface DepartmentRow {
  id: string;
  company_id: string;
  name: string;
  parent_department_id: string | null;
  is_assignable: boolean;
}

interface JobPositionRow {
  id: string;
  company_id: string;
  department_id: string;
  name: string;
  code: string | null;
  active: boolean;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
  department_id: string | null;
  job_position_id: string | null;
  validation_status: ValidationStatus;
  created_at: string;
}

interface ScheduleConfigRow {
  id: string;
  department_id: string;
  schedule_type: "3t5" | "jornada_normal";
}

interface BillingAccountRow {
  id: string;
  owner_company_id: string | null;
  owner_user_id: string | null;
  current_billing_state: string;
}

const errorCopy: Record<string, string> = {
  "auth-user-create-failed":
    "No se pudo crear la cuenta de acceso. Comprueba si el email ya existe.",
  "auth-user-not-found": "No se encontro la cuenta Auth del usuario.",
  "authentication-required": "Inicia sesion para abrir Console.",
  "company-create-failed": "No se pudo crear la empresa. Revisa el slug.",
  "company-not-found": "No se encontro la empresa.",
  "company-theme-save-failed": "No se pudo guardar el color corporativo.",
  "department-create-failed": "No se pudo crear el departamento.",
  forbidden: "Tu usuario no tiene rol activo de plataforma.",
  "invalid-company-theme":
    "Usa un color hexadecimal valido, por ejemplo #2563eb.",
  "invalid-company-name": "El nombre de empresa no es valido.",
  "invalid-company-slug":
    "El slug solo puede usar minusculas, numeros y guiones.",
  "invalid-department": "Revisa los datos del departamento.",
  "invalid-department-name": "El nombre de area o departamento no es valido.",
  "invalid-department-scope":
    "El departamento elegido no pertenece a esa empresa.",
  "invalid-job-position": "Revisa los datos del puesto.",
  "invalid-schedule-config": "La configuracion de turno no es valida.",
  "invalid-user": "Revisa nombre y email del usuario.",
  "invalid-user-role": "Ese rol no se puede asignar desde Console.",
  "invalid-user-scope": "Empresa o departamento no validos.",
  "job-position-create-failed": "No se pudo crear el puesto.",
  "password-mismatch": "Las contrasenas temporales no coinciden.",
  "password-missing-letter": "La contrasena debe incluir al menos una letra.",
  "password-missing-number": "La contrasena debe incluir al menos un numero.",
  "password-reset-failed": "No se pudo resetear la contrasena.",
  "password-too-short": "La contrasena debe tener al menos 8 caracteres.",
  "permission-denied": "Tu rol de plataforma no permite esta accion.",
  "profile-create-failed":
    "La cuenta Auth se creo, pero no se pudo crear el perfil operativo.",
  "schedule-config-save-failed":
    "No se pudo guardar la configuracion de turnos.",
  "user-not-found": "No se encontro el usuario operativo.",
};

const successCopy: Record<string, string> = {
  "company-created": "Empresa creada con area y departamento inicial.",
  "company-theme-updated": "Color corporativo actualizado.",
  "department-created": "Departamento creado.",
  "job-position-created": "Puesto creado.",
  "password-reset":
    "Contrasena temporal asignada. En el proximo login debera cambiarla.",
  "schedule-config-saved": "Tipo de turno actualizado.",
  "user-created":
    "Usuario creado con contrasena temporal y cambio obligatorio.",
};

const creatableRoles: UserRole[] = ["member", "department_admin", "hr_admin"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
}

function scheduleTypeLabel(value: string | null | undefined) {
  switch (value) {
    case "3t5":
      return "3 turnos / 5 grupos";
    case "jornada_normal":
      return "Jornada normal";
    default:
      return "Sin configurar";
  }
}

function AccessDeniedState({ message }: { message: string }) {
  return (
    <section className="grid min-h-[calc(100vh-9rem)] place-items-center">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">
              Sin acceso a Console
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {message}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/home">Volver a la app</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

function Feedback({
  error,
  status,
}: {
  error?: string;
  status?: string;
}) {
  const errorMessage = error ? errorCopy[error] ?? errorCopy["forbidden"] : null;
  const successMessage = status ? successCopy[status] : null;

  if (!errorMessage && !successMessage) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        errorMessage
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-800"
      )}
    >
      <div className="flex items-start gap-3">
        {errorMessage ? (
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        )}
        <p>{errorMessage ?? successMessage}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums">
              {value}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionDetails({
  badge,
  children,
  description,
  icon: Icon,
  open = false,
  title,
}: {
  badge?: string;
  children: React.ReactNode;
  description: string;
  icon: LucideIcon;
  open?: boolean;
  title: string;
}) {
  return (
    <details
      className="group rounded-2xl border border-border/80 bg-card/96 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
      open={open}
    >
      <summary className="grid cursor-pointer list-none gap-4 px-5 py-4 outline-none transition-colors hover:bg-secondary/40 focus-visible:ring-4 focus-visible:ring-primary/15 sm:grid-cols-[1fr_auto] sm:items-center [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold tracking-[-0.02em]">
              {title}
            </span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              {description}
            </span>
          </span>
        </div>
        <span className="flex flex-wrap items-center gap-2 sm:justify-end">
          {badge ? <Badge variant="outline">{badge}</Badge> : null}
          <span
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "pointer-events-none"
            )}
          >
            <span className="group-open:hidden">Abrir</span>
            <span className="hidden group-open:inline">Cerrar</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </span>
        </span>
      </summary>
      <div className="border-t border-border/70 p-5">{children}</div>
    </details>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default async function ConsolePage({ searchParams }: ConsolePageProps) {
  const params = await searchParams;
  const access = await getCurrentPlatformAccess();

  if (!access.ok) {
    if (access.error === "authentication-required") {
      redirect("/login");
    }

    return (
      <AccessDeniedState
        message={errorCopy[access.error] ?? "No tienes acceso a Console."}
      />
    );
  }

  const admin = createAdminClient();
  const [
    { data: companies, error: companiesError },
    { data: departments, error: departmentsError },
    { data: jobPositions, error: jobPositionsError },
    { data: users, error: usersError },
    { data: scheduleConfigs, error: scheduleConfigsError },
    { data: billingAccounts },
  ] = await Promise.all([
    admin
      .from("companies")
      .select("id, name, slug, theme_config, created_at")
      .order("name"),
    admin
      .from("departments")
      .select("id, company_id, name, parent_department_id, is_assignable")
      .order("name"),
    admin
      .from("job_positions")
      .select("id, company_id, department_id, name, code, active")
      .order("name"),
    admin
      .from("user_profiles")
      .select(
        "id, email, full_name, role, company_id, department_id, job_position_id, validation_status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(150),
    admin
      .from("area_schedule_configs")
      .select("id, department_id, schedule_type"),
    admin
      .from("billing_accounts")
      .select("id, owner_company_id, owner_user_id, current_billing_state"),
  ]);

  if (companiesError || departmentsError || jobPositionsError || usersError || scheduleConfigsError) {
    throw new Error("No se pudo cargar ShiftSwap Console.");
  }

  const companyRows = (companies ?? []) as CompanyRow[];
  const departmentRows = (departments ?? []) as DepartmentRow[];
  const jobPositionRows = (jobPositions ?? []) as JobPositionRow[];
  const userRows = (users ?? []) as UserRow[];
  const scheduleConfigRows = (scheduleConfigs ?? []) as ScheduleConfigRow[];
  const billingRows = (billingAccounts ?? []) as BillingAccountRow[];

  const canManage = canManagePlatform(access.admin);
  const canOperateUsers = canOperatePlatformUsers(access.admin);
  const companyMap = new Map(companyRows.map((company) => [company.id, company]));
  const departmentMap = new Map(
    departmentRows.map((department) => [department.id, department])
  );
  const jobPositionMap = new Map(
    jobPositionRows.map((position) => [position.id, position])
  );
  const scheduleConfigMap = new Map(
    scheduleConfigRows.map((config) => [config.department_id, config])
  );
  const areas = departmentRows.filter((department) => !department.parent_department_id);
  const operationalDepartments = departmentRows.filter(
    (department) => department.is_assignable
  );
  const approvedUsers = userRows.filter(
    (user) => user.validation_status === "approved"
  );
  const pendingUsers = userRows.filter(
    (user) => user.validation_status === "pending"
  );
  const activeBilling = billingRows.filter((row) =>
    ["trialing", "active", "past_due"].includes(row.current_billing_state)
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-end">
        <div className="min-w-0">
          <Badge className="mb-3" variant="secondary">
            Plataforma
          </Badge>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            ShiftSwap Console
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            Control global de empresas, usuarios, departamentos y configuracion
            laboral sin mezclarlo con la administracion interna de una empresa.
          </p>
        </div>

        <Card size="sm">
          <CardContent>
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold tracking-[-0.02em]">
                  Acceso actual
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {access.admin.display_name ?? access.admin.user_id}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{PLATFORM_ROLE_LABELS[access.admin.role]}</Badge>
                  <Badge variant="outline">Activo</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Feedback error={params.error} status={params.status} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={`${activeBilling.length} con billing activo/trial`}
          icon={Building2}
          label="Empresas"
          value={companyRows.length}
        />
        <MetricCard
          detail={`${pendingUsers.length} pendientes de validacion`}
          icon={Users}
          label="Usuarios"
          value={userRows.length}
        />
        <MetricCard
          detail={`${areas.length} areas raiz`}
          icon={BriefcaseBusiness}
          label="Departamentos operativos"
          value={operationalDepartments.length}
        />
        <MetricCard
          detail={`${areas.length - scheduleConfigRows.length} areas sin tipo`}
          icon={CalendarCog}
          label="Tipos de turno"
          value={scheduleConfigRows.length}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <a
          className="rounded-2xl border border-border/80 bg-card px-4 py-3 text-sm transition-colors hover:bg-secondary/45"
          href="#companies"
        >
          <span className="font-semibold">Empresas</span>
          <span className="mt-1 block text-muted-foreground">
            Estado, billing y volumen.
          </span>
        </a>
        <a
          className="rounded-2xl border border-border/80 bg-card px-4 py-3 text-sm transition-colors hover:bg-secondary/45"
          href="#users"
        >
          <span className="font-semibold">Usuarios</span>
          <span className="mt-1 block text-muted-foreground">
            Altas, roles y resets.
          </span>
        </a>
        <a
          className="rounded-2xl border border-border/80 bg-card px-4 py-3 text-sm transition-colors hover:bg-secondary/45"
          href="#structure"
        >
          <span className="font-semibold">Estructura</span>
          <span className="mt-1 block text-muted-foreground">
            Departamentos y puestos.
          </span>
        </a>
        <a
          className="rounded-2xl border border-border/80 bg-card px-4 py-3 text-sm transition-colors hover:bg-secondary/45"
          href="#schedule"
        >
          <span className="font-semibold">Turnos</span>
          <span className="mt-1 block text-muted-foreground">
            Jornada normal o 3T5.
          </span>
        </a>
      </section>

      <section className="space-y-4" id="companies">
        <SectionDetails
          badge={`${companyRows.length} empresas`}
          description="Vista compacta de empresas, usuarios y estado comercial."
          icon={Building2}
          open
          title="Empresas"
        >
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-border/70 bg-secondary/35 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Empresa</th>
                  <th className="px-4 py-3 font-semibold">Usuarios</th>
                  <th className="px-4 py-3 font-semibold">Pendientes</th>
                  <th className="px-4 py-3 font-semibold">Departamentos</th>
                  <th className="px-4 py-3 font-semibold">Color</th>
                  <th className="px-4 py-3 font-semibold">Billing</th>
                  <th className="px-4 py-3 font-semibold">Alta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {companyRows.map((company) => {
                  const companyUsers = userRows.filter(
                    (user) => user.company_id === company.id
                  );
                  const companyBilling = billingRows.find(
                    (billing) => billing.owner_company_id === company.id
                  );
                  const accentColor = getCompanyThemeAccentColor(
                    company.theme_config
                  );

                  return (
                    <tr key={company.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{company.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {company.slug}
                        </p>
                      </td>
                      <td className="px-4 py-3">{companyUsers.length}</td>
                      <td className="px-4 py-3">
                        {
                          companyUsers.filter(
                            (user) => user.validation_status === "pending"
                          ).length
                        }
                      </td>
                      <td className="px-4 py-3">
                        {
                          departmentRows.filter(
                            (department) => department.company_id === company.id
                          ).length
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span
                            className="size-4 rounded-full border border-border"
                            style={
                              accentColor
                                ? { backgroundColor: accentColor }
                                : undefined
                            }
                          />
                          <span className="font-mono text-xs text-muted-foreground">
                            {accentColor ?? "por defecto"}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {companyBilling?.current_billing_state ?? "sin cuenta"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(company.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canManage ? (
            <div className="mt-5 grid gap-3">
              <div>
                <h3 className="font-semibold">Color corporativo</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Solo el admin principal de plataforma puede cambiar el color
                  visual del dashboard de cada empresa.
                </p>
              </div>
              {companyRows.map((company) => (
                <form
                  action={updatePlatformCompanyThemeAction}
                  className="grid gap-4 rounded-2xl border border-border/70 bg-secondary/25 p-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,420px)_auto] md:items-end"
                  key={`company-theme-${company.id}`}
                >
                  <input name="companyId" type="hidden" value={company.id} />
                  <input name="returnTo" type="hidden" value="/console" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{company.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {company.slug}
                    </p>
                  </div>
                  <ColorPaletteField
                    defaultValue={getCompanyThemeAccentColor(
                      company.theme_config
                    )}
                    label="Color"
                    name="accentColor"
                    paletteLabel={`Paleta de ${company.name}`}
                  />
                  <Button type="submit" variant="outline">
                    <Palette className="size-4" />
                    Guardar color
                  </Button>
                </form>
              ))}
            </div>
          ) : null}

          {canManage ? (
            <form
              action={createPlatformCompanyAction}
              className="mt-5 grid gap-4 rounded-2xl border border-border/70 bg-secondary/25 p-4 lg:grid-cols-2"
            >
              <div className="lg:col-span-2">
                <h3 className="font-semibold">Crear empresa</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crea la empresa con un area y departamento inicial para poder
                  dar de alta usuarios despues.
                </p>
              </div>
              <Field label="Nombre de empresa">
                <Input name="companyName" required />
              </Field>
              <Field label="Slug">
                <Input
                  name="companySlug"
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="empresa-norte"
                  required
                />
              </Field>
              <Field label="Area inicial">
                <Input defaultValue="General" name="areaName" required />
              </Field>
              <Field label="Departamento inicial">
                <Input defaultValue="Equipo base" name="departmentName" required />
              </Field>
              <div className="lg:col-span-2">
                <Button type="submit">
                  <Plus className="size-4" />
                  Crear empresa
                </Button>
              </div>
            </form>
          ) : null}
        </SectionDetails>
      </section>

      <section className="space-y-4" id="users">
        <SectionDetails
          badge={`${approvedUsers.length} aprobados`}
          description="Crea cuentas con contrasena temporal y fuerza el cambio en el siguiente login."
          icon={Users}
          open
          title="Usuarios"
        >
          {canManage ? (
            <form
              action={createPlatformUserAction}
              className="mb-5 grid gap-4 rounded-2xl border border-border/70 bg-secondary/25 p-4 md:grid-cols-2 xl:grid-cols-3"
            >
              <div className="md:col-span-2 xl:col-span-3">
                <h3 className="font-semibold">Crear usuario</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  La contrasena es temporal y el usuario tendra que cambiarla.
                </p>
              </div>
              <Field label="Nombre">
                <Input name="fullName" required />
              </Field>
              <Field label="Email">
                <Input name="email" required type="email" />
              </Field>
              <Field label="Rol">
                <select
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  name="role"
                  required
                >
                  {creatableRoles.map((role) => (
                    <option key={role} value={role}>
                      {USER_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Empresa">
                <select
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  name="companyId"
                  required
                >
                  <option value="">Selecciona empresa</option>
                  {companyRows.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Departamento operativo">
                <select
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  name="departmentId"
                  required
                >
                  <option value="">Selecciona departamento</option>
                  {operationalDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {companyMap.get(department.company_id)?.name} /{" "}
                      {department.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Puesto">
                <select
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  name="jobPositionId"
                >
                  <option value="">Sin puesto</option>
                  {jobPositionRows.map((position) => (
                    <option key={position.id} value={position.id}>
                      {companyMap.get(position.company_id)?.name} /{" "}
                      {position.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contrasena temporal">
                <Input
                  autoComplete="new-password"
                  minLength={8}
                  name="temporaryPassword"
                  required
                  type="password"
                />
              </Field>
              <Field label="Confirmar contrasena">
                <Input
                  autoComplete="new-password"
                  minLength={8}
                  name="confirmTemporaryPassword"
                  required
                  type="password"
                />
              </Field>
              <div className="flex items-end">
                <Button type="submit">
                  <KeyRound className="size-4" />
                  Crear usuario
                </Button>
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border/70 bg-secondary/35 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Usuario</th>
                  <th className="px-4 py-3 font-semibold">Empresa</th>
                  <th className="px-4 py-3 font-semibold">Departamento</th>
                  <th className="px-4 py-3 font-semibold">Puesto</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Acceso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {userRows.map((user) => {
                  const company = user.company_id
                    ? companyMap.get(user.company_id)
                    : null;
                  const department = user.department_id
                    ? departmentMap.get(user.department_id)
                    : null;
                  const jobPosition = user.job_position_id
                    ? jobPositionMap.get(user.job_position_id)
                    : null;

                  return (
                    <tr key={user.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-muted-foreground">{user.email}</p>
                      </td>
                      <td className="px-4 py-3">{company?.name ?? "Global"}</td>
                      <td className="px-4 py-3">
                        {department?.name ?? "Sin departamento"}
                      </td>
                      <td className="px-4 py-3">
                        {jobPosition?.name ?? "Sin puesto"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{USER_ROLE_LABELS[user.role]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{user.validation_status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {canOperateUsers ? (
                          <details>
                            <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline">
                              Resetear
                            </summary>
                            <form
                              action={resetPlatformUserPasswordAction}
                              className="mt-3 grid w-72 gap-2"
                            >
                              <input name="userId" type="hidden" value={user.id} />
                              <Input
                                autoComplete="new-password"
                                minLength={8}
                                name="temporaryPassword"
                                placeholder="Contrasena temporal"
                                required
                                type="password"
                              />
                              <Input
                                autoComplete="new-password"
                                minLength={8}
                                name="confirmTemporaryPassword"
                                placeholder="Confirmar"
                                required
                                type="password"
                              />
                              <Button size="sm" type="submit" variant="outline">
                                Forzar cambio
                              </Button>
                            </form>
                          </details>
                        ) : (
                          <span className="text-muted-foreground">Lectura</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionDetails>
      </section>

      <section className="space-y-4" id="structure">
        <SectionDetails
          badge={`${departmentRows.length} departamentos`}
          description="Gestiona areas, departamentos operativos y puestos."
          icon={BriefcaseBusiness}
          title="Estructura laboral"
        >
          {canManage ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <form
                action={createPlatformDepartmentAction}
                className="grid gap-4 rounded-2xl border border-border/70 bg-secondary/25 p-4"
              >
                <div>
                  <h3 className="font-semibold">Crear area/departamento</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sin area padre se crea un area. Con padre, un departamento
                    operativo.
                  </p>
                </div>
                <Field label="Empresa">
                  <select
                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                    name="companyId"
                    required
                  >
                    <option value="">Selecciona empresa</option>
                    {companyRows.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Area padre opcional">
                  <select
                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                    name="parentDepartmentId"
                  >
                    <option value="">Crear area raiz</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {companyMap.get(area.company_id)?.name} / {area.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nombre">
                  <Input name="departmentName" required />
                </Field>
                <Button type="submit">
                  <Plus className="size-4" />
                  Guardar departamento
                </Button>
              </form>

              <form
                action={createPlatformJobPositionAction}
                className="grid gap-4 rounded-2xl border border-border/70 bg-secondary/25 p-4"
              >
                <div>
                  <h3 className="font-semibold">Crear puesto</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Los puestos solo pueden pertenecer a departamentos operativos.
                  </p>
                </div>
                <Field label="Empresa">
                  <select
                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                    name="companyId"
                    required
                  >
                    <option value="">Selecciona empresa</option>
                    {companyRows.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Departamento">
                  <select
                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                    name="departmentId"
                    required
                  >
                    <option value="">Selecciona departamento</option>
                    {operationalDepartments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {companyMap.get(department.company_id)?.name} /{" "}
                        {department.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nombre del puesto">
                  <Input name="jobPositionName" required />
                </Field>
                <Field label="Codigo opcional">
                  <Input name="jobPositionCode" />
                </Field>
                <Button type="submit">
                  <Plus className="size-4" />
                  Crear puesto
                </Button>
              </form>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Departamentos</CardTitle>
                <CardDescription>Areas raiz y equipos operativos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {departmentRows.map((department) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2"
                    key={department.id}
                  >
                    <div>
                      <p className="font-medium">{department.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {companyMap.get(department.company_id)?.name}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {department.is_assignable ? "Operativo" : "Area"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle>Puestos</CardTitle>
                <CardDescription>Catalogo laboral activo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {jobPositionRows.map((position) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2"
                    key={position.id}
                  >
                    <div>
                      <p className="font-medium">{position.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {departmentMap.get(position.department_id)?.name ?? "Sin depto"}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {position.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </SectionDetails>
      </section>

      <section className="space-y-4" id="schedule">
        <SectionDetails
          badge={`${scheduleConfigRows.length}/${areas.length} areas`}
          description="Configura si cada area trabaja en 3T5 o jornada normal."
          icon={CalendarCog}
          title="Tipos de turno"
        >
          <div className="grid gap-3">
            {areas.map((area) => {
              const config = scheduleConfigMap.get(area.id);

              return (
                <form
                  action={updatePlatformScheduleConfigAction}
                  className="grid gap-3 rounded-2xl border border-border/70 p-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end"
                  key={area.id}
                >
                  <input name="departmentId" type="hidden" value={area.id} />
                  <div>
                    <p className="font-medium">{area.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {companyMap.get(area.company_id)?.name} · Actual:{" "}
                      {scheduleTypeLabel(config?.schedule_type)}
                    </p>
                  </div>
                  <Field label="Tipo">
                    <select
                      className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                      defaultValue={config?.schedule_type ?? "3t5"}
                      disabled={!canManage}
                      name="scheduleType"
                    >
                      <option value="3t5">3 turnos / 5 grupos</option>
                      <option value="jornada_normal">Jornada normal</option>
                    </select>
                  </Field>
                  <Button disabled={!canManage} type="submit" variant="outline">
                    Guardar
                  </Button>
                </form>
              );
            })}
          </div>
        </SectionDetails>
      </section>
    </div>
  );
}
