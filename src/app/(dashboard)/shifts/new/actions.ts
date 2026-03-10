"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ShiftType } from "@/types";

export interface CreateShiftState {
  error?: string;
}

export async function createShift(
  _prevState: CreateShiftState,
  formData: FormData
): Promise<CreateShiftState> {
  const date = formData.get("date") as string;
  const shiftType = formData.get("shift_type") as ShiftType;
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;
  const description = (formData.get("description") as string) || null;
  const userId = formData.get("user_id") as string;
  const departmentId = formData.get("department_id") as string;

  if (!date || !shiftType || !startTime || !endTime || !userId || !departmentId) {
    return { error: "Todos los campos obligatorios deben estar rellenados." };
  }

  const validShiftTypes: ShiftType[] = ["morning", "afternoon", "night"];
  if (!validShiftTypes.includes(shiftType)) {
    return { error: "Tipo de turno no válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("shifts").insert({
    user_id: userId,
    department_id: departmentId,
    date,
    start_time: startTime,
    end_time: endTime,
    shift_type: shiftType,
    description: description || undefined,
    status: "open",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/shifts");
  redirect("/shifts");
}
