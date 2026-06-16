import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ShiftForm } from "./shift-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { todayISO, formatDateISO } from "@/lib/calendar";
import { getUserCalendar } from "@/lib/calendar-data";
import { getShiftPublicationScopeData } from "@/lib/shift-publication-scope-server";
import { createClient } from "@/lib/supabase/server";

export default async function NewShiftPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const scopeResult = await getShiftPublicationScopeData(authUser.id);

  if (!scopeResult.success && !scopeResult.actionHref) {
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
            {scopeResult.error} Recarga la pagina o contacta con un
            administrador.
          </p>
        </div>
      </div>
    );
  }

  if (!scopeResult.success) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Publicacion"
          title="Publicar nuevo turno"
          description="Para publicar como trabajador necesitas tener un departamento operativo asignado."
          action={
            <Link href="/shifts">
              <Button variant="ghost">
                <ArrowLeft className="size-4" />
                Volver a turnos
              </Button>
            </Link>
          }
        />
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Asigna primero tu departamento</CardTitle>
            <CardDescription>
              El tablon puede verse con permisos administrativos, pero una
              publicacion de turno siempre debe salir de un departamento
              operativo concreto.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              {scopeResult.error} Asi el turno queda asociado al equipo
              correcto.
            </p>
            <Link href={scopeResult.actionHref ?? "/profile"}>
              <Button>{scopeResult.actionLabel ?? "Ir a mi perfil"}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Load calendar for the next 180 days to enable client-side hints
  const today = todayISO();
  const futureDateSeed = new Date();
  futureDateSeed.setDate(futureDateSeed.getDate() + 180);
  const futureDate = formatDateISO(futureDateSeed);
  const calendarDays = await getUserCalendar(authUser.id, today, futureDate);

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
        departments={scopeResult.data.departments}
        jobPositions={scopeResult.data.jobPositions}
        defaultDepartmentId={scopeResult.data.defaultDepartmentId}
        defaultJobPositionId={scopeResult.data.defaultJobPositionId}
        calendarDays={calendarDays}
      />
    </div>
  );
}
