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
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Administracion"
        title="Solicitud de validacion"
        description="Revisa los datos enviados, comprueba la evidencia adjunta y toma una decision clara para desbloquear o corregir el alta."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge className="border-amber-500/15 bg-amber-500/10 text-amber-700">
              Pendiente
            </Badge>
            <Link href="/admin/validations">
              <Button variant="outline">Volver al listado</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="gap-3">
            <div className="space-y-2">
              <CardTitle>{detail.full_name}</CardTitle>
              <CardDescription>
                Comprueba que los datos personales y laborales coinciden con la
                documentacion enviada antes de activar la cuenta.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Email
                </p>
                <p className="mt-2 break-words font-medium text-foreground">
                  {detail.email}
                </p>
              </div>
              <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Telefono
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {detail.phone ?? "No indicado"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Empresa
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {detail.company_id
                    ? companyMap.get(detail.company_id) ?? "Sin empresa"
                    : "Sin empresa"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Departamento
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {detail.department_id
                    ? departmentMap.get(detail.department_id) ?? "Sin departamento"
                    : "Sin departamento"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  ID de empleado
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {detail.employee_id ?? "No indicado"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Registrado
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {new Intl.DateTimeFormat("es-ES", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(detail.created_at))}
                </p>
              </div>
            </div>

            <ValidationDecisionForm
              userId={detail.id}
              fullName={detail.full_name}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-2">
            <CardTitle>Carne de empresa</CardTitle>
            <CardDescription>
              Usa esta vista como referencia visual antes de aprobar o rechazar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {signedIdCardUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedIdCardUrl}
                alt={`Carne de ${detail.full_name}`}
                className="w-full rounded-2xl border border-border/75 object-cover shadow-sm"
              />
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-border/80 px-4 text-center text-sm text-muted-foreground">
                No se pudo generar la vista previa del carne.
              </div>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              La URL firmada caduca en 10 minutos.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
