import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import { isSuperAdmin, USER_ROLE_LABELS } from "@/lib/user-roles";
import { PANEL_CLASSNAME, cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { UserFilters } from "./user-filters";
import { UserRoleForm } from "./user-role-form";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  company_id: string | null;
  department_id: string | null;
}

interface NamedEntity {
  id: string;
  name: string;
}

interface PageProps {
  searchParams: Promise<{
    company_id?: string;
    department_id?: string;
    role?: string;
    q?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { company_id, department_id, role: filterRole, q } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const accountState = await getAccountGateState(user.id);
  if (!accountState || !isSuperAdmin(accountState.role)) {
    redirect("/admin/validations");
  }

  let usersQuery = supabase
    .from("user_profiles")
    .select("id, full_name, email, role, company_id, department_id")
    .eq("validation_status", "approved")
    .order("full_name");

  if (company_id) {
    usersQuery = usersQuery.eq("company_id", company_id);
  }
  if (department_id) {
    usersQuery = usersQuery.eq("department_id", department_id);
  }
  if (filterRole) {
    usersQuery = usersQuery.eq("role", filterRole);
  }

  const [{ data: users, error }, { data: companies }, { data: departments }] =
    await Promise.all([
      usersQuery,
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("departments").select("id, name").order("name"),
    ]);

  if (error) {
    throw new Error("No se pudieron cargar los usuarios.");
  }

  const companyMap = new Map(
    ((companies ?? []) as NamedEntity[]).map((company) => [company.id, company.name])
  );
  const departmentMap = new Map(
    ((departments ?? []) as NamedEntity[]).map((department) => [
      department.id,
      department.name,
    ])
  );

  const searchTerm = q?.toLowerCase().trim();
  const approvedUsers = ((users ?? []) as UserRow[]).filter(
    (u) => !searchTerm || u.full_name.toLowerCase().includes(searchTerm) || u.email.toLowerCase().includes(searchTerm)
  );
  const hasFilters = !!(company_id || department_id || filterRole || q);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administracion"
        title="Roles de usuario"
        description="Asigna permisos con rapidez y deja claro el alcance de cada cuenta aprobada dentro del producto."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{USER_ROLE_LABELS[accountState.role]}</Badge>
            <Link href="/admin/exchanges">
              <Button variant="outline">Aprobaciones</Button>
            </Link>
            <Link href="/admin/validations">
              <Button variant="outline">Volver a validaciones</Button>
            </Link>
          </div>
        }
      />

      <UserFilters
        companies={(companies ?? []) as NamedEntity[]}
        departments={(departments ?? []) as NamedEntity[]}
      />

      <p className="text-sm text-muted-foreground">
        {approvedUsers.length === 0
          ? hasFilters
            ? "No hay usuarios que coincidan con los filtros aplicados."
            : "No hay usuarios aprobados para gestionar todavia."
          : `${approvedUsers.length} usuario${approvedUsers.length !== 1 ? "s" : ""}${hasFilters ? " con los filtros activos" : ""}.`}
      </p>

      {approvedUsers.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="Todavia no hay cuentas activas"
          description="Cuando existan usuarios aprobados podras asignar aqui permisos administrativos y revisar su alcance."
          action={
            <Link href="/admin/validations">
              <Button variant="outline">Ir a validaciones</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {approvedUsers.map((profile) => {
            const companyLabel = profile.company_id
              ? companyMap.get(profile.company_id) ?? "Sin empresa"
              : "Global";
            const departmentLabel = profile.department_id
              ? departmentMap.get(profile.department_id) ?? "Sin departamento"
              : "Sin departamento";

            return (
              <div
                key={profile.id}
                className={cn(
                  PANEL_CLASSNAME,
                  "grid gap-3 px-4 py-3 lg:grid-cols-[minmax(14rem,1.25fr)_minmax(9rem,0.8fr)_minmax(10rem,0.9fr)_auto] lg:items-center",
                )}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 flex-nowrap items-center gap-2">
                    <h2
                      title={profile.full_name}
                      className="min-w-0 truncate text-base font-semibold leading-6 tracking-[-0.02em] text-foreground"
                    >
                      {profile.full_name}
                    </h2>
                    <Badge className="shrink-0 border-sky-500/15 bg-sky-500/10 text-sky-700">
                      <ShieldCheck className="size-3.5" />
                      {USER_ROLE_LABELS[profile.role]}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {profile.email}
                  </p>
                </div>

                <div className="min-w-0 rounded-xl border border-border/60 bg-secondary/25 px-3 py-2 lg:border-transparent lg:bg-transparent lg:px-0 lg:py-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Empresa
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                    {companyLabel}
                  </p>
                </div>

                <div className="min-w-0 rounded-xl border border-border/60 bg-secondary/25 px-3 py-2 lg:border-transparent lg:bg-transparent lg:px-0 lg:py-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Departamento
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                    {departmentLabel}
                  </p>
                </div>

                <UserRoleForm
                  userId={profile.id}
                  fullName={profile.full_name}
                  currentRole={profile.role}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
