import "server-only";

import { ACTIVE_EXCHANGE_SLOT_LOCK_STATUSES } from "@/lib/exchange-slot-locks";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickFirstRelation } from "@/lib/supabase-relations";
import type { ExchangeAgreementType, ExchangeStatus, ShiftType } from "@/types";

const ACTIVE_STATUSES = [...ACTIVE_EXCHANGE_SLOT_LOCK_STATUSES];

interface ActiveExchangeDateRow {
  id: string;
  status: ExchangeStatus;
  agreement_type: ExchangeAgreementType | null;
  user_a_id: string;
  user_b_id: string;
  compensation_shift_date: string | null;
  shift:
    | {
        date: string;
      }
    | {
        date: string;
      }[]
    | null;
}

interface PendingProposalDateRow {
  id: string;
  shift_id: string;
  interested_user_id: string;
  agreement_type: ExchangeAgreementType | null;
  compensation_shift_date: string | null;
  compensation_shift_type: ShiftType | "rest" | null;
  shift:
    | {
        date: string;
        user_id: string;
      }
    | {
        date: string;
        user_id: string;
      }[]
    | null;
}

interface OpenShiftDateRow {
  id: string;
  user_id: string;
  date: string;
  shift_type: ShiftType;
}

interface PendingShiftRequestRow {
  id: string;
  shift_id: string;
  interested_user_id: string;
}

export interface PendingProposalDateConflict {
  id: string;
  shiftId: string;
  interestedUserId: string;
  shiftOwnerId: string;
  date: string;
}

export interface CancelledOpenShiftDateConflict {
  id: string;
  userId: string;
  date: string;
  shiftType: ShiftType;
  pendingRequests: PendingShiftRequestRow[];
}

function uniqueDates(dates: Array<string | null | undefined>): string[] {
  return [...new Set(dates.filter((date): date is string => Boolean(date)))];
}

function touchesAnyDate(
  row: PendingProposalDateRow,
  dateSet: Set<string>,
): boolean {
  const shift = pickFirstRelation(row.shift);
  return (
    Boolean(shift?.date && dateSet.has(shift.date)) ||
    Boolean(row.compensation_shift_date && dateSet.has(row.compensation_shift_date))
  );
}

export async function findActiveExchangeDateConflict({
  userId,
  dates,
  excludeExchangeId,
}: {
  userId: string;
  dates: string[];
  excludeExchangeId?: string | null;
}): Promise<ActiveExchangeDateRow | null> {
  const targetDates = uniqueDates(dates);

  if (targetDates.length === 0) {
    return null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("exchanges")
    .select(
      `
      id,
      status,
      agreement_type,
      user_a_id,
      user_b_id,
      compensation_shift_date,
      shift:shifts!shift_id(date)
    `,
    )
    .in("status", ACTIVE_STATUSES)
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  if (error) {
    console.error("[exchange-date-conflicts] Failed to load active exchanges", {
      userId,
      dates: targetDates,
      message: error.message,
    });
    return null;
  }

  const dateSet = new Set(targetDates);

  return (
    ((data ?? []) as ActiveExchangeDateRow[]).find((exchange) => {
      if (excludeExchangeId && exchange.id === excludeExchangeId) {
        return false;
      }

      const shift = pickFirstRelation(exchange.shift);
      return (
        Boolean(shift?.date && dateSet.has(shift.date)) ||
        Boolean(
          exchange.agreement_type === "shift_exchange" &&
            exchange.compensation_shift_date &&
            dateSet.has(exchange.compensation_shift_date),
        )
      );
    }) ?? null
  );
}

export async function withdrawPendingProposalDateConflicts({
  userId,
  dates,
  excludeRequestId,
}: {
  userId: string;
  dates: string[];
  excludeRequestId?: string | null;
}): Promise<PendingProposalDateConflict[]> {
  const targetDates = uniqueDates(dates);

  if (targetDates.length === 0) {
    return [];
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("shift_requests")
    .select(
      `
      id,
      shift_id,
      interested_user_id,
      agreement_type,
      compensation_shift_date,
      compensation_shift_type,
      shift:shifts!shift_id(date, user_id)
    `,
    )
    .eq("interested_user_id", userId)
    .eq("status", "pending");

  if (excludeRequestId) {
    query = query.neq("id", excludeRequestId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "[exchange-date-conflicts] Failed to load pending proposal conflicts",
      {
        userId,
        dates: targetDates,
        message: error.message,
      },
    );
    return [];
  }

  const dateSet = new Set(targetDates);
  const conflicts = ((data ?? []) as PendingProposalDateRow[])
    .filter((row) => touchesAnyDate(row, dateSet))
    .map((row) => {
      const shift = pickFirstRelation(row.shift);
      return shift
        ? {
            id: row.id,
            shiftId: row.shift_id,
            interestedUserId: row.interested_user_id,
            shiftOwnerId: shift.user_id,
            date: shift.date,
          }
        : null;
    })
    .filter((row): row is PendingProposalDateConflict => Boolean(row));

  if (conflicts.length === 0) {
    return [];
  }

  const { error: updateError } = await supabase
    .from("shift_requests")
    .update({ status: "withdrawn" })
    .in(
      "id",
      conflicts.map((conflict) => conflict.id),
    )
    .eq("status", "pending");

  if (updateError) {
    console.error(
      "[exchange-date-conflicts] Failed to withdraw pending proposal conflicts",
      {
        userId,
        dates: targetDates,
        message: updateError.message,
      },
    );
    return [];
  }

  return conflicts;
}

export async function cancelOpenShiftDateConflicts({
  userId,
  dates,
  excludeShiftId,
}: {
  userId: string;
  dates: string[];
  excludeShiftId?: string | null;
}): Promise<CancelledOpenShiftDateConflict[]> {
  const targetDates = uniqueDates(dates);

  if (targetDates.length === 0) {
    return [];
  }

  const supabase = createAdminClient();
  let shiftQuery = supabase
    .from("shifts")
    .select("id, user_id, date, shift_type")
    .eq("user_id", userId)
    .eq("status", "open")
    .in("date", targetDates);

  if (excludeShiftId) {
    shiftQuery = shiftQuery.neq("id", excludeShiftId);
  }

  const { data: shifts, error } = await shiftQuery;

  if (error) {
    console.error("[exchange-date-conflicts] Failed to load open shift conflicts", {
      userId,
      dates: targetDates,
      message: error.message,
    });
    return [];
  }

  const conflictShifts = (shifts ?? []) as OpenShiftDateRow[];

  if (conflictShifts.length === 0) {
    return [];
  }

  const shiftIds = conflictShifts.map((shift) => shift.id);
  const { data: pendingRequests } = await supabase
    .from("shift_requests")
    .select("id, shift_id, interested_user_id")
    .in("shift_id", shiftIds)
    .eq("status", "pending");

  const { error: cancelError } = await supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .in("id", shiftIds)
    .eq("status", "open");

  if (cancelError) {
    console.error("[exchange-date-conflicts] Failed to cancel open shifts", {
      userId,
      dates: targetDates,
      message: cancelError.message,
    });
    return [];
  }

  await supabase
    .from("shift_requests")
    .update({ status: "rejected" })
    .in("shift_id", shiftIds)
    .eq("status", "pending");

  const requestsByShiftId = new Map<string, PendingShiftRequestRow[]>();

  for (const request of (pendingRequests ?? []) as PendingShiftRequestRow[]) {
    const existing = requestsByShiftId.get(request.shift_id) ?? [];
    existing.push(request);
    requestsByShiftId.set(request.shift_id, existing);
  }

  return conflictShifts.map((shift) => ({
    id: shift.id,
    userId: shift.user_id,
    date: shift.date,
    shiftType: shift.shift_type,
    pendingRequests: requestsByShiftId.get(shift.id) ?? [],
  }));
}
