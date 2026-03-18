import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ValidationDecisionForm } from "../validation-decision-form";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface ValidationDetail {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  employee_id: string | null;
  id_card_url: string | null;
  company_id: string | null;
  department_id: string | null;
  created_at: string;
}

interface NamedEntity {
  id: string;
  name: string;
}

export default async function ValidationDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: validation, error } = await supabase
    .from("user_profiles")
    .select(
      "id, email, full_name, phone, employee_id, id_card_url, company_id, department_id, created_at"
    )
    .eq("id", id)
    .eq("validation_status", "pending")
    .maybeSingle();

  if (error) {
    throw new Error("No se pudo cargar la solicitud.");
  }

  if (!validation) {
    redirect("/admin/validations");
  }

  const companyIds = validation.company_id ? [validation.company_id] : [];
  const departmentIds = validation.department_id ? [validation.department_id] : [];

  const [{ data: companies }, { data: departments }] = await Promise.all([
    companyIds.length > 0
      ? supabase.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] as NamedEntity[], error: null }),
    departmentIds.length > 0
      ? supabase.from("departments").select("id, name").in("id", departmentIds)
      : Promise.resolve({ data: [] as NamedEntity[], error: null }),
  ]);

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
  let signedIdCardUrl: string | null = null;

  if ((validation as ValidationDetail).id_card_url) {
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from("id-cards")
      .createSignedUrl((validation as ValidationDetail).id_card_url!, 600);

    if (signedUrlError) {
      console.error("[admin/validations] Failed to create signed ID card URL", {
        userId: id,
        message: signedUrlError.message,
      });
    } else {
      signedIdCardUrl = signedUrlData.signedUrl;
    }
  }

  const detail = validation as ValidationDetail;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Solicitud de validación
          </h1>
          <p className="text-sm text-muted-foreground">
            Revisa la evidencia enviada y decide si la cuenta puede activarse.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/admin/validations">Volver al listado</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{detail.full_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-foreground">Email</dt>
                <dd className="text-muted-foreground">{detail.email}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Teléfono</dt>
                <dd className="text-muted-foreground">
                  {detail.phone ?? "No indicado"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Empresa</dt>
                <dd className="text-muted-foreground">
                  {detail.company_id
                    ? companyMap.get(detail.company_id) ?? "Sin empresa"
                    : "Sin empresa"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Departamento</dt>
                <dd className="text-muted-foreground">
                  {detail.department_id
                    ? departmentMap.get(detail.department_id) ?? "Sin departamento"
                    : "Sin departamento"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">ID de empleado</dt>
                <dd className="text-muted-foreground">
                  {detail.employee_id ?? "No indicado"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Registrado</dt>
                <dd className="text-muted-foreground">
                  {new Intl.DateTimeFormat("es-ES", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(detail.created_at))}
                </dd>
              </div>
            </dl>

            <ValidationDecisionForm
              userId={detail.id}
              fullName={detail.full_name}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carné de empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {signedIdCardUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedIdCardUrl}
                alt={`Carné de ${detail.full_name}`}
                className="w-full rounded-lg border object-cover"
              />
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
                No se pudo generar la vista previa del carné.
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              La URL firmada caduca en 10 minutos.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
