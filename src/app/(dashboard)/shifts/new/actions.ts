"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isValidWorkDay } from "@/lib/calendar";
import { getUserCalendarInput } from "@/lib/calendar-data";
import { SHIFT_TYPE_LABELS } from "@/lib/constants";
import { findActiveExchangeDateConflict } from "@/lib/exchange-date-conflicts";
import { getMadridDateInputValue } from "@/lib/exchange-compensation";
import {
  findActiveExchangeSlotLock,
  isActiveExchangeSlotLockError,
} from "@/lib/exchange-slot-locks";
import {
  getShiftSchedule,
  isShiftType,
  matchesShiftSchedule,
  validateShiftCoverageWindow,
} from "@/lib/shifts";
import { requireSignature } from "@/lib/user-profiles";
import { createClient } from "@/lib/supabase/server";

export interface CreateShiftState {
  error?: string;
}

export async function createShift(
  _prevState: CreateShiftState,
  formData: FormData
): Promise<CreateShiftState> {
  const date = formData.get("date") as string;
  const shiftType = formData.get("shift_type") as string;
  const submittedStartTime = formData.get("start_time") as string | null;
  const submittedEndTime = formData.get("end_time") as string | null;
  const submittedCoverageStartTime = formData.get("coverage_start_time") as
    | string
    | null;
  const submittedCoverageEndTime = formData.get("coverage_end_time") as
    | string
    | null;
  const description = (formData.get("description") as string) || null;
  const acceptedModalities = formData.getAll("accepted_modalities") as string[];

  if (!date || !shiftType) {
    return {
      error: "Completa la fecha y el tipo de turno para poder publicarlo.",
    };
  }

  const validModalities = acceptedModalities.filter(
    (m) => m === "hours_bank" || m === "shift_exchange"
  );

  if (validModalities.length === 0) {
    return {
      error: "Selecciona al menos una modalidad de compensacion.",
    };
  }

  if (!isShiftType(shiftType)) {
    return { error: "Selecciona un tipo de turno valido." };
  }

  if (date < getMadridDateInputValue()) {
    return {
      error: "No puedes publicar un turno de una fecha que ya ha pasado.",
    };
  }

  const schedule = getShiftSchedule(shiftType);
  const hasCoverageWindow = Boolean(
    submittedCoverageStartTime || submittedCoverageEndTime
  );
  let coverageStartTime: string | null = null;
  let coverageEndTime: string | null = null;

  if (
    (submittedStartTime || submittedEndTime) &&
    !matchesShiftSchedule(shiftType, submittedStartTime, submittedEndTime)
  ) {
    return {
      error: `El turno de ${SHIFT_TYPE_LABELS[
        shiftType
      ].toLowerCase()} usa siempre el horario ${schedule.startTime} - ${
        schedule.endTime
      }. Vuelve a elegir el tipo de turno para recalcularlo.`,
    };
  }

  if (hasCoverageWindow) {
    if (
      !validModalities.includes("hours_bank") ||
      validModalities.includes("shift_exchange")
    ) {
      return {
        error:
          "La cobertura parcial solo es compatible con bolsa de horas.",
      };
    }

    const coverageCheck = validateShiftCoverageWindow({
      shiftStartTime: schedule.startTime,
      shiftEndTime: schedule.endTime,
      coverageStartTime: submittedCoverageStartTime,
      coverageEndTime: submittedCoverageEndTime,
    });

    if (!coverageCheck.valid) {
      return { error: coverageCheck.reason };
    }

    coverageStartTime = coverageCheck.startTime;
    coverageEndTime = coverageCheck.endTime;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autorizado." };
  }

  const signatureCheck = await requireSignature(user.id);
  if (signatureCheck.error) return { error: signatureCheck.error };

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("department_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { error: "No se pudo validar tu departamento actual." };
  }

  if (!profile?.department_id) {
    return {
      error:
        "Tu perfil no tiene un departamento operativo asignado. Revisa tu perfil antes de publicar un turno.",
    };
  }

  const [
    { data: department, error: departmentError },
    { data: childDepartments, error: childDepartmentsError },
  ] = await Promise.all([
    supabase
      .from("departments")
      .select("id, is_assignable")
      .eq("id", profile.department_id)
      .maybeSingle(),
    supabase
      .from("departments")
      .select("id")
      .eq("parent_department_id", profile.department_id)
      .limit(1),
  ]);

  if (departmentError || childDepartmentsError) {
    return { error: "No se pudo validar tu departamento operativo." };
  }

  if (!department?.is_assignable || (childDepartments?.length ?? 0) > 0) {
    return {
      error:
        "Tu cuenta sigue asociada a un area general. Necesitas un departamento operativo final para publicar turnos.",
    };
  }

  // Calendar validation: check if the user can work this shift on this date
  const calendarConfig = await getUserCalendarInput({
    userId: user.id,
    startDate: date,
    endDate: date,
  });

  const workDayCheck = isValidWorkDay(date, shiftType, calendarConfig);
  if (!workDayCheck.valid) {
    return { error: workDayCheck.reason };
  }

  const activeExchangeLock = await findActiveExchangeSlotLock({
    userId: user.id,
    date,
    shiftType,
  });

  if (activeExchangeLock) {
    return {
      error:
        "Ese turno ya forma parte de un intercambio activo y no puede volver a publicarse.",
    };
  }

  const activeExchangeDateConflict = await findActiveExchangeDateConflict({
    userId: user.id,
    dates: [date],
  });

  if (activeExchangeDateConflict) {
    return {
      error:
        "Ya tienes un cambio activo en esa fecha y no puedes publicar otro turno ese mismo dia.",
    };
  }

  const { error } = await supabase.from("shifts").insert({
    user_id: user.id,
    department_id: profile.department_id,
    date,
    // The stored schedule is derived from shift_type to prevent invalid mixes.
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    coverage_start_time: coverageStartTime,
    coverage_end_time: coverageEndTime,
    shift_type: shiftType,
    description: description || undefined,
    accepted_modalities: validModalities,
    status: "open",
  });

  if (error) {
    if (isActiveExchangeSlotLockError(error)) {
      return {
        error:
          "Ese turno ya forma parte de un intercambio activo y no puede volver a publicarse.",
      };
    }

    return { error: error.message };
  }

  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
  redirect("/shifts/my");
}
