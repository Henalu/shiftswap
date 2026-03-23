import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, SearchX } from "lucide-react";
import { ShiftCard } from "@/components/shifts/shift-card";
import { ShiftFilters } from "@/components/shifts/shift-filters";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import type { ShiftWithUser } from "@/types";

interface PageProps {
  searchParams: Promise<{
    department_id?: string;
    shift_type?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function ShiftsPage({ searchParams }: PageProps) {
  const { department_id, shift_type, from, to } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name");

  let query = supabase
    .from("shifts")
    .select(
      `
      *,
      user:user_profiles!user_id(id, email, full_name, avatar_url, department_id, company_id),
      department:departments!department_id(id, name)
    `
    )
    .eq("status", "open")
    .neq("user_id", authUser.id)
    .order("date", { ascending: true });

  if (department_id) {
    query = query.eq("department_id", department_id);
  }
  if (shift_type) {
    query = query.eq("shift_type", shift_type);
  }
  if (from) {
    query = query.gte("date", from);
  }
  if (to) {
    query = query.lte("date", to);
  }

  const { data: shifts } = await query;

  const { data: myRequests } = await supabase
    .from("shift_requests")
    .select("id, shift_id")
    .eq("interested_user_id", authUser.id)
    .in("status", ["pending", "accepted"]);

  const myRequestMap = new Map((myRequests ?? []).map((request) => [request.shift_id, request.id]));
  const typedShifts = (shifts ?? []).map((shift) => ({
    ...shift,
    user: shift.user,
    department: shift.department,
  })) as ShiftWithUser[];

  const hasFilters = !!(department_id || shift_type || from || to);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace interno"
        title="Turnos disponibles"
        description="Compara rapidamente los turnos abiertos, filtra por contexto y deja claro cuando quieres iniciar un intercambio."
        action={
          <Link href="/shifts/new">
            <Button>
              <Plus className="size-4" />
              Publicar turno
            </Button>
          </Link>
        }
      />

      <ShiftFilters departments={departments ?? []} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {typedShifts.length === 0
            ? hasFilters
              ? "No hay turnos que coincidan con los filtros aplicados."
              : "No hay turnos publicados en este momento."
            : `${typedShifts.length} turno${typedShifts.length !== 1 ? "s" : ""} disponible${typedShifts.length !== 1 ? "s" : ""}${hasFilters ? " con tus filtros activos" : ""}.`}
        </p>
      </div>

      {typedShifts.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {typedShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              currentUserId={authUser.id}
              initialInterested={myRequestMap.has(shift.id)}
              requestId={myRequestMap.get(shift.id) ?? null}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<SearchX className="size-5" />}
          title={hasFilters ? "Ajusta la busqueda" : "Todavia no hay turnos abiertos"}
          description={
            hasFilters
              ? "Prueba con otro departamento, un rango de fechas distinto o elimina filtros para volver a ver mas opciones."
              : "Cuando alguien publique un turno para intercambio aparecera aqui listo para comparar y solicitar."
          }
          action={
            hasFilters ? (
              <Button asChild variant="outline">
                <Link href="/shifts">Ver todos los turnos</Link>
              </Button>
            ) : (
              <Link href="/shifts/new">
                <Button variant="outline">Publicar el primer turno</Button>
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
