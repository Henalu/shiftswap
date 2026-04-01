import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ShiftForm } from "./shift-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function NewShiftPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles")
    .select("department_id")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!profile && profileError) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Publicacion"
          title="Publicar nuevo turno"
          description="No se ha podido cargar tu perfil."
        />
        <div className="rounded-2xl border border-destructive/15 bg-destructive/10 p-6 text-sm text-foreground">
          <p className="font-semibold">Error al cargar los datos</p>
          <p className="mt-2 text-muted-foreground">
            No hemos podido verificar tu departamento para publicar un turno. Recarga la
            pagina o contacta con un administrador.
          </p>
        </div>
      </div>
    );
  }

  if (!profile?.department_id) {
    redirect("/profile?setup=1");
  }

  const { data: department } = await adminClient
    .from("departments")
    .select("id, name, parent_department_id")
    .eq("id", profile.department_id)
    .maybeSingle();

  if (!department) {
    redirect("/profile?setup=1");
  }

  const { data: parentDepartment } = department.parent_department_id
    ? await adminClient
        .from("departments")
        .select("name")
        .eq("id", department.parent_department_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Publicacion"
        title="Publicar nuevo turno"
        description="Completa solo la informacion necesaria para que otros empleados puedan comparar tu turno y responder con rapidez."
        action={
          <Link href="/shifts">
            <Button variant="ghost">
              <ArrowLeft className="size-4" />
              Volver a turnos
            </Button>
          </Link>
        }
      />
      <ShiftForm
        areaName={parentDepartment?.name ?? department.name}
        departmentName={department.name}
      />
    </div>
  );
}
