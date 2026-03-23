import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import { isSuperAdmin, USER_ROLE_LABELS } from "@/lib/user-roles";
import type { UserRole } from "@/types";
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

export default async function AdminUsersPage() {
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

  const [{ data: users, error }, { data: companies }, { data: departments }] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("id, full_name, email, role, company_id, department_id")
        .eq("validation_status", "approved")
        .order("full_name"),
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

  const approvedUsers = (users ?? []) as UserRow[];

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

      <p className="text-sm text-muted-foreground">
        {approvedUsers.length === 0
          ? "No hay usuarios aprobados para gestionar todavia."
          : `${approvedUsers.length} usuario${approvedUsers.length !== 1 ? "s" : ""} aprobado${approvedUsers.length !== 1 ? "s" : ""} listo${approvedUsers.length !== 1 ? "s" : ""} para ajuste de rol.`}
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
        <div className="space-y-4">
          {approvedUsers.map((profile) => {
            const companyLabel = profile.company_id
              ? companyMap.get(profile.company_id) ?? "Sin empresa"
              : "Global";
            const departmentLabel = profile.department_id
              ? departmentMap.get(profile.department_id) ?? "Sin departamento"
              : "Sin departamento";

            return (
              <Card key={profile.id}>
                <CardHeader className="gap-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{profile.full_name}</CardTitle>
                        <Badge className="border-sky-500/15 bg-sky-500/10 text-sky-700">
                          <ShieldCheck className="size-3.5" />
                          {USER_ROLE_LABELS[profile.role]}
                        </Badge>
                      </div>
                      <CardDescription>{profile.email}</CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Empresa
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {companyLabel}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Departamento
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {departmentLabel}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/75 bg-background/90 px-4 py-4">
                    <UserRoleForm
                      userId={profile.id}
                      fullName={profile.full_name}
                      currentRole={profile.role}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
