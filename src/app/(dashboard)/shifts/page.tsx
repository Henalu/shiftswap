import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShiftCard } from "@/components/shifts/shift-card";
import { ShiftFilters } from "@/components/shifts/shift-filters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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

  // Fetch departments for the filter dropdown
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name");

  // Build filtered shifts query
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

  const typedShifts = (shifts ?? []).map((s) => ({
    ...s,
    user: s.user,
    department: s.department,
  })) as ShiftWithUser[];

  const hasFilters = !!(department_id || shift_type || from || to);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Turnos disponibles
        </h1>
        <Link href="/shifts/new">
          <Button>
            <Plus className="mr-2 size-4" />
            Publicar turno
          </Button>
        </Link>
      </div>

      <ShiftFilters departments={departments ?? []} />

      <p className="text-sm text-muted-foreground">
        {typedShifts.length === 0
          ? hasFilters
            ? "Ningún turno coincide con los filtros aplicados."
            : "No hay turnos disponibles en este momento."
          : `${typedShifts.length} turno${typedShifts.length !== 1 ? "s" : ""} disponible${typedShifts.length !== 1 ? "s" : ""}${hasFilters ? " con los filtros aplicados" : ""}`}
      </p>

      {typedShifts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {typedShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              currentUserId={authUser.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
