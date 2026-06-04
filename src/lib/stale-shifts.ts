import "server-only";

import { getMadridDateInputValue } from "@/lib/exchange-compensation";
import { createAdminClient } from "@/lib/supabase/admin";

interface ExpireStaleOpenShiftsInput {
  userId?: string;
  shiftId?: string;
}

export function isPastShiftPublicationDate(
  shiftDate: string | null | undefined,
  today: string = getMadridDateInputValue(),
): boolean {
  return Boolean(shiftDate && shiftDate < today);
}

export async function expireStaleOpenShifts({
  userId,
  shiftId,
}: ExpireStaleOpenShiftsInput = {}): Promise<string[]> {
  const supabase = createAdminClient();
  const today = getMadridDateInputValue();

  let query = supabase
    .from("shifts")
    .select("id")
    .eq("status", "open")
    .lt("date", today);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (shiftId) {
    query = query.eq("id", shiftId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[stale-shifts] Failed to load stale shifts", {
      userId,
      shiftId,
      message: error.message,
    });
    return [];
  }

  const staleShiftIds = (data ?? []).map((shift) => shift.id);

  if (staleShiftIds.length === 0) {
    return [];
  }

  const { error: expireError } = await supabase
    .from("shifts")
    .update({ status: "expired" })
    .in("id", staleShiftIds)
    .eq("status", "open");

  if (expireError) {
    console.error("[stale-shifts] Failed to expire stale shifts", {
      userId,
      shiftId,
      message: expireError.message,
    });
    return [];
  }

  await supabase
    .from("shift_requests")
    .update({ status: "rejected" })
    .in("shift_id", staleShiftIds)
    .eq("status", "pending");

  return staleShiftIds;
}
