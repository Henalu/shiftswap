"use server";

import { formatDateISO, todayISO, type CalendarDay } from "@/lib/calendar";
import { getUserCalendar } from "@/lib/calendar-data";
import {
  getShiftPublicationScopeData,
  type ShiftPublicationScopeData,
} from "@/lib/shift-publication-scope-server";
import { createClient } from "@/lib/supabase/server";

export interface PublishShiftFormData extends ShiftPublicationScopeData {
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

  const scopeResult = await getShiftPublicationScopeData(user.id);

  if (!scopeResult.success) {
    return scopeResult;
  }

  const today = todayISO();
  const futureDateSeed = new Date();
  futureDateSeed.setDate(futureDateSeed.getDate() + 180);
  const futureDate = formatDateISO(futureDateSeed);
  const calendarDays = await getUserCalendar(user.id, today, futureDate);

  return {
    success: true,
    data: {
      ...scopeResult.data,
      calendarDays,
    },
  };
}
