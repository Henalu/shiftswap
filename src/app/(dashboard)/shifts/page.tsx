import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, SearchX } from "lucide-react";
import { ShiftCard } from "@/components/shifts/shift-card";
import { ShiftFilters } from "@/components/shifts/shift-filters";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  getDepartmentScopeLabel,
  isOperationalDepartment,
} from "@/lib/departments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Department, ShiftWithUser, UserRole } from "@/types";

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
  const adminClient = createAdminClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, company_id, department_id")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!profile?.department_id) {
    redirect("/profile?setup=1");
  }

  const role = (profile.role ?? "member") as UserRole;
  const canBrowseDepartments = role === "hr_admin" || role === "super_admin";
  const { data: departments } = await adminClient
    .from("departments")
    .select("id, name, company_id, parent_department_id, is_assignable, created_at")
    .order("name");

  const typedDepartments = (departments ?? []) as Department[];
  const filterableDepartments = typedDepartments
    .filter((department) => {
      if (!isOperationalDepartment(department, typedDepartments)) {
        return false;
      }

      if (role === "super_admin") {
        return true;
      }

      return department.company_id === profile.company_id;
    })
    .map((department) => ({
      id: department.id,
      name: department.name,
    }));

  const canApplyDepartmentFilter =
    canBrowseDepartments &&
    filterableDepartments.some((department) => department.id === department_id);
  const effectiveDepartmentId = canApplyDepartmentFilter
    ? department_id
    : canBrowseDepartments
      ? undefined
      : profile.department_id;
  const scopeLabel = getDepartmentScopeLabel(typedDepartments, profile.department_id);

  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("shifts")
    .select(
      `
      *,
      user:user_profiles!user_id(id, email, full_name, avatar_url, department_id, company_id),
      department:departments!department_id(id, name, parent_department_id)
    `
    )
    .eq("status", "open")
    .gte("date", today)
    .neq("user_id", authUser.id)
    .order("date", { ascending: true });

  if (effectiveDepartmentId) {
    query = query.eq("department_id", effectiveDepartmentId);
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

  const myRequestMap = new Map(
    (myRequests ?? []).map((request) => [request.shift_id, request.id])
  );
  const typedShifts = (shifts ?? []).map((shift) => ({
    ...shift,
    user: shift.user,
    department: shift.department,
  })) as ShiftWithUser[];
  const hasFilters = !!(effectiveDepartmentId || shift_type || from || to);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace interno"
        title="Turnos disponibles"
        description={
          canBrowseDepartments
            ? "Compara rapidamente los turnos abiertos, filtra por contexto y entra solo en los intercambios que correspondan a tu alcance."
            : `Este tablon muestra solo los turnos abiertos de tu departamento${scopeLabel ? `: ${scopeLabel}.` : "."}`
        }
        action={
          <Link href="/shifts/new">
            <Button>
              <Plus className="size-4" />
              Publicar turno
            </Button>
          </Link>
        }
      />

      <ShiftFilters
        departments={filterableDepartments}
        showDepartmentFilter={canBrowseDepartments}
        scopeLabel={scopeLabel}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {typedShifts.length === 0
            ? hasFilters
              ? "No hay turnos que coincidan con los filtros aplicados."
              : canBrowseDepartments
                ? "No hay turnos publicados en este momento."
                : "No hay turnos publicados ahora mismo dentro de tu departamento."
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
              ? canBrowseDepartments
                ? "Prueba con otro departamento operativo, un rango de fechas distinto o elimina filtros para volver a ver mas opciones."
                : "Prueba con otro rango de fechas o elimina filtros para volver a ver los turnos de tu departamento."
              : canBrowseDepartments
                ? "Cuando alguien publique un turno para intercambio aparecera aqui listo para comparar y solicitar."
                : "Cuando alguien publique un turno en tu departamento aparecera aqui listo para comparar y solicitar."
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
