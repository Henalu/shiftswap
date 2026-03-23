import Link from "next/link";
import { redirect } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import { getAccountGateState } from "@/lib/user-profiles";
import { isSuperAdmin, USER_ROLE_LABELS } from "@/lib/user-roles";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    company_id?: string;
    department_id?: string;
  }>;
}

interface PendingValidationRow {
  id: string;
  email: string;
  full_name: string;
  employee_id: string | null;
  id_card_url: string | null;
  company_id: string | null;
  department_id: string | null;
}

interface NamedEntity {
  id: string;
  name: string;
}

interface PendingValidationItem extends PendingValidationRow {
  company_name: string;
  department_name: string;
  signed_id_card_url: string | null;
}

export default async function AdminValidationsPage({
  searchParams,
}: PageProps) {
  const { q, company_id, department_id } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const accountState = await getAccountGateState(user.id);
  if (!accountState) {
    redirect("/shifts");
  }

  let query = supabase
    .from("user_profiles")
    .select(
      "id, email, full_name, employee_id, id_card_url, company_id, department_id"
    )
    .eq("validation_status", "pending")
    .order("created_at", { ascending: true });

  if (q) {
    query = query.ilike("full_name", `%${q}%`);
  }

  if (company_id) {
    query = query.eq("company_id", company_id);
  }

  if (department_id) {
    query = query.eq("department_id", department_id);
  }

  const [{ data: pendingValidations, error }, { data: companies }, { data: departments }] =
    await Promise.all([
      query,
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("departments").select("id, name").order("name"),
    ]);

  if (error) {
    throw new Error("No se pudieron cargar las validaciones pendientes.");
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

  const adminClient = createAdminClient();
  const validations = await Promise.all(
    ((pendingValidations ?? []) as PendingValidationRow[]).map(
      async (validation): Promise<PendingValidationItem> => {
        let signedIdCardUrl: string | null = null;

        if (validation.id_card_url) {
          const { data: signedUrlData, error: signedUrlError } =
            await adminClient.storage
              .from("id-cards")
              .createSignedUrl(validation.id_card_url, 600);

          if (signedUrlError) {
            console.error(
              "[admin/validations] Failed to create signed ID card URL",
              {
                userId: validation.id,
                message: signedUrlError.message,
              }
            );
          } else {
            signedIdCardUrl = signedUrlData.signedUrl;
          }
        }

        return {
          ...validation,
          company_name: validation.company_id
            ? companyMap.get(validation.company_id) ?? "Sin empresa"
            : "Sin empresa",
          department_name: validation.department_id
            ? departmentMap.get(validation.department_id) ?? "Sin departamento"
            : "Sin departamento",
          signed_id_card_url: signedIdCardUrl,
        };
      }
    )
  );

  const hasFilters = Boolean(q || company_id || department_id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administracion"
        title="Validaciones de empleados"
        description="Filtra rapidamente las solicitudes pendientes y revisa la documentacion con una vista clara antes de aprobar o rechazar."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{USER_ROLE_LABELS[accountState.role]}</Badge>
            {isSuperAdmin(accountState.role) && (
              <Link href="/admin/users">
                <Button variant="outline">Gestionar roles</Button>
              </Link>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader className="gap-2">
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Reduce la cola por nombre, empresa o departamento y deja mas visible
            lo que requiere decision inmediata.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto_auto] lg:items-end">
            <div className="space-y-2">
              <label
                htmlFor="validation-search"
                className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Nombre
              </label>
              <Input
                id="validation-search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por nombre"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="company-filter"
                className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Empresa
              </label>
              <select
                id="company-filter"
                name="company_id"
                defaultValue={company_id ?? ""}
                className={FORM_CONTROL_CLASSNAME}
              >
                <option value="">Todas</option>
                {((companies ?? []) as NamedEntity[]).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="department-filter"
                className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Departamento
              </label>
              <select
                id="department-filter"
                name="department_id"
                defaultValue={department_id ?? ""}
                className={FORM_CONTROL_CLASSNAME}
              >
                <option value="">Todos</option>
                {((departments ?? []) as NamedEntity[]).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit">Aplicar filtros</Button>

            {hasFilters && (
              <Link href="/admin/validations">
                <Button type="button" variant="ghost">
                  Limpiar
                </Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {validations.length === 0
          ? hasFilters
            ? "No hay solicitudes pendientes con los filtros aplicados."
            : "No hay solicitudes pendientes dentro de tu alcance."
          : `${validations.length} solicitud${validations.length !== 1 ? "es" : ""} pendiente${validations.length !== 1 ? "s" : ""} lista${validations.length !== 1 ? "s" : ""} para revision.`}
      </p>

      {validations.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No hay coincidencias" : "No hay revisiones pendientes"}
          description={
            hasFilters
              ? "Prueba con otra combinacion de filtros para volver a ver solicitudes activas."
              : "Cuando entren nuevas solicitudes de alta apareceran aqui para revision manual."
          }
          action={
            hasFilters ? (
              <Link href="/admin/validations">
                <Button variant="outline">Quitar filtros</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {validations.map((validation) => (
            <Card key={validation.id}>
              <CardContent className="grid gap-5 pt-5 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">
                        {validation.full_name}
                      </h2>
                      <Badge className="border-amber-500/15 bg-amber-500/10 text-amber-700">
                        Pendiente
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {validation.email}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Empresa
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {validation.company_name}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Departamento
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {validation.department_name}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        ID de empleado
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {validation.employee_id ?? "No indicado"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Link href={`/admin/validations/${validation.id}`}>
                      <Button>Revisar solicitud</Button>
                    </Link>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">
                    Carne de empresa
                  </p>
                  {validation.signed_id_card_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={validation.signed_id_card_url}
                      alt={`Carne de ${validation.full_name}`}
                      className="h-44 w-full rounded-2xl border border-border/75 object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-border/80 px-4 text-center text-sm text-muted-foreground">
                      No se pudo generar la vista previa del carne.
                    </div>
                  )}
                  <p className="text-xs leading-5 text-muted-foreground">
                    La URL firmada caduca en 10 minutos.
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
