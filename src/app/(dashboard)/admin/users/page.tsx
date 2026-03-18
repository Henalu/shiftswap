import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Roles de usuario
            </h1>
            <Badge variant="outline">{USER_ROLE_LABELS[accountState.role]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Asigna permisos de administración y alcance a los usuarios ya
            validados.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/admin/validations">Volver a validaciones</Link>
        </Button>
      </div>

      {approvedUsers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay usuarios aprobados</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cuando existan cuentas activas podrás asignarles roles desde aquí.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvedUsers.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">{profile.full_name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {profile.email}
                    </p>
                  </div>

                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-foreground">Empresa</dt>
                      <dd className="text-muted-foreground">
                        {profile.company_id
                          ? companyMap.get(profile.company_id) ?? "Sin empresa"
                          : "Global"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">
                        Departamento
                      </dt>
                      <dd className="text-muted-foreground">
                        {profile.department_id
                          ? departmentMap.get(profile.department_id) ??
                            "Sin departamento"
                          : "Sin departamento"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="space-y-3">
                  <Badge variant="secondary" className="w-fit">
                    {USER_ROLE_LABELS[profile.role]}
                  </Badge>
                  <UserRoleForm
                    userId={profile.id}
                    fullName={profile.full_name}
                    currentRole={profile.role}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
