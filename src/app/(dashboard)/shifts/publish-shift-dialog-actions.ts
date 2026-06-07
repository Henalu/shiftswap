"use server";

import { formatDateISO, todayISO, type CalendarDay } from "@/lib/calendar";
import { getUserCalendar } from "@/lib/calendar-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface PublishShiftFormData {
  areaName: string;
  departmentName: string;
  calendarDays: CalendarDay[] | null;
}

export type PublishShiftFormResult =
  | { success: true; data: PublishShiftFormData }
  | {
      success: false;
      error: string;
      actionHref?: string;
      actionLabel?: string;
    };

export async function getPublishShiftFormData(): Promise<PublishShiftFormResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "Inicia sesion para publicar un turno.",
      actionHref: "/login",
      actionLabel: "Ir al login",
    };
  }

  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles")
    .select("department_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      success: false,
      error:
        "No hemos podido verificar tu departamento para publicar un turno.",
    };
  }

  if (!profile?.department_id) {
    return {
      success: false,
      error:
        "Necesitas tener un departamento operativo asignado antes de publicar un turno.",
      actionHref: "/profile",
      actionLabel: "Ir a mi perfil",
    };
  }

  const [
    { data: department, error: departmentError },
    { data: childDepartments, error: childDepartmentsError },
  ] = await Promise.all([
    adminClient
      .from("departments")
      .select("id, name, parent_department_id, is_assignable")
      .eq("id", profile.department_id)
      .maybeSingle(),
    adminClient
      .from("departments")
      .select("id")
      .eq("parent_department_id", profile.department_id)
      .limit(1),
  ]);

  if (departmentError || childDepartmentsError || !department) {
    return {
      success: false,
      error:
        "No hemos podido cargar el departamento desde el que se publicara el turno.",
      actionHref: "/profile",
      actionLabel: "Revisar perfil",
    };
  }

  if (!department.is_assignable || (childDepartments?.length ?? 0) > 0) {
    return {
      success: false,
      error:
        "Tu cuenta sigue asociada a un area general. Elige un departamento operativo final antes de publicar.",
      actionHref: "/profile",
      actionLabel: "Ir a mi perfil",
    };
  }

  const { data: parentDepartment } = department.parent_department_id
    ? await adminClient
        .from("departments")
        .select("name")
        .eq("id", department.parent_department_id)
        .maybeSingle()
    : { data: null };

  const today = todayISO();
  const futureDateSeed = new Date();
  futureDateSeed.setDate(futureDateSeed.getDate() + 180);
  const futureDate = formatDateISO(futureDateSeed);
  const calendarDays = await getUserCalendar(user.id, today, futureDate);

  return {
    success: true,
    data: {
      areaName: parentDepartment?.name ?? department.name,
      departmentName: department.name,
      calendarDays,
    },
  };
}
