import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Validaciones de empleados
            </h1>
            <Badge variant="outline">{USER_ROLE_LABELS[accountState.role]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Revisa las solicitudes pendientes dentro de tu alcance y decide si
            la cuenta puede activarse.
          </p>
        </div>

        {isSuperAdmin(accountState.role) && (
          <Button asChild variant="outline">
            <Link href="/admin/users">Gestionar roles</Link>
          </Button>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-60 flex-1 flex-col gap-1">
          <label
            htmlFor="validation-search"
            className="text-xs font-medium text-muted-foreground"
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

        <div className="flex min-w-52 flex-col gap-1">
          <label
            htmlFor="company-filter"
            className="text-xs font-medium text-muted-foreground"
          >
            Empresa
          </label>
          <select
            id="company-filter"
            name="company_id"
            defaultValue={company_id ?? ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todas</option>
            {((companies ?? []) as NamedEntity[]).map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-52 flex-col gap-1">
          <label
            htmlFor="department-filter"
            className="text-xs font-medium text-muted-foreground"
          >
            Departamento
          </label>
          <select
            id="department-filter"
            name="department_id"
            defaultValue={department_id ?? ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            {((departments ?? []) as NamedEntity[]).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit">Filtrar</Button>

        {hasFilters && (
          <Button asChild type="button" variant="ghost">
            <Link href="/admin/validations">Limpiar</Link>
          </Button>
        )}
      </form>

      <p className="text-sm text-muted-foreground">
        {validations.length === 0
          ? hasFilters
            ? "No hay solicitudes pendientes con los filtros aplicados."
            : "No hay solicitudes pendientes dentro de tu alcance."
          : `${validations.length} solicitud${validations.length !== 1 ? "es" : ""} pendiente${validations.length !== 1 ? "s" : ""}`}
      </p>

      {validations.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay revisiones pendientes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cuando entren nuevas solicitudes de alta aparecerán aquí para su
            revisión manual.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {validations.map((validation) => (
            <Card key={validation.id}>
              <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">
                      {validation.full_name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {validation.email}
                    </p>
                  </div>

                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-foreground">Empresa</dt>
                      <dd className="text-muted-foreground">
                        {validation.company_name}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">
                        Departamento
                      </dt>
                      <dd className="text-muted-foreground">
                        {validation.department_name}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">
                        ID de empleado
                      </dt>
                      <dd className="text-muted-foreground">
                        {validation.employee_id ?? "No indicado"}
                      </dd>
                    </div>
                  </dl>

                  <Button asChild size="sm">
                    <Link href={`/admin/validations/${validation.id}`}>
                      Ver solicitud
                    </Link>
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Carné de empresa
                  </p>
                  {validation.signed_id_card_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={validation.signed_id_card_url}
                      alt={`Carné de ${validation.full_name}`}
                      className="h-44 w-full rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
                      No se pudo generar la vista previa del carné.
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
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
