import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { pickFirstRelation } from "@/lib/supabase-relations";
import { isShiftType } from "@/lib/shifts";
import type {
  CalendarExchangeOverlayEntry,
  ExchangeStatus,
  ShiftType,
} from "@/types";

export const ACTIVE_EXCHANGE_SLOT_LOCK_STATUSES = [
  "accepted",
  "pending_validation",
  "approved",
  "completed",
] as const satisfies readonly ExchangeStatus[];

export const ACTIVE_EXCHANGE_SHIFT_INDEX =
  "idx_exchanges_unique_active_shift";
export const ACTIVE_EXCHANGE_COMPENSATION_INDEX =
  "idx_exchanges_unique_active_compensation_slot";

export type ExchangeSlotLockKind = "received" | "delivered";

export interface ExchangeSlotLock {
  exchangeId: string;
  date: string;
  shiftType: ShiftType;
  kind: ExchangeSlotLockKind;
}

interface ActiveExchangeSlotRow {
  id: string;
  status: ExchangeStatus;
  user_a_id: string;
  user_b_id: string;
  compensation_shift_date: string | null;
  compensation_shift_type: ShiftType | "rest" | null;
  shift:
    | {
        date: string;
        shift_type: string;
      }
    | {
        date: string;
        shift_type: string;
      }[]
    | null;
}

function isWithinDateRange(
  date: string,
  startDate: string,
  endDate: string,
): boolean {
  return date >= startDate && date <= endDate;
}

function toExchangeSlotLockRows(
  exchange: ActiveExchangeSlotRow,
  userId: string,
): ExchangeSlotLock[] {
  const shift = pickFirstRelation(exchange.shift);
  const publishedShiftType = shift?.shift_type;
  const compensationShiftType = exchange.compensation_shift_type;

  if (
    !shift?.date ||
    !isShiftType(publishedShiftType) ||
    !exchange.compensation_shift_date ||
    !isShiftType(compensationShiftType)
  ) {
    return [];
  }

  if (exchange.user_a_id === userId) {
    return [
      {
        exchangeId: exchange.id,
        date: shift.date,
        shiftType: publishedShiftType,
        kind: "delivered",
      },
      {
        exchangeId: exchange.id,
        date: exchange.compensation_shift_date,
        shiftType: compensationShiftType,
        kind: "received",
      },
    ];
  }

  if (exchange.user_b_id === userId) {
    return [
      {
        exchangeId: exchange.id,
        date: exchange.compensation_shift_date,
        shiftType: compensationShiftType,
        kind: "delivered",
      },
      {
        exchangeId: exchange.id,
        date: shift.date,
        shiftType: publishedShiftType,
        kind: "received",
      },
    ];
  }

  return [];
}

export async function getUserActiveExchangeSlotLocks({
  userId,
  startDate,
  endDate,
}: {
  userId: string;
  startDate: string;
  endDate: string;
}): Promise<ExchangeSlotLock[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("exchanges")
    .select(
      `
      id,
      status,
      user_a_id,
      user_b_id,
      compensation_shift_date,
      compensation_shift_type,
      shift:shifts!shift_id(date, shift_type)
    `,
    )
    .eq("agreement_type", "shift_exchange")
    .in("status", [...ACTIVE_EXCHANGE_SLOT_LOCK_STATUSES])
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  if (error) {
    console.error("[exchange-slot-locks] Failed to load active exchanges", {
      userId,
      startDate,
      endDate,
      message: error.message,
    });
    return [];
  }

  return ((data ?? []) as ActiveExchangeSlotRow[])
    .flatMap((exchange) => toExchangeSlotLockRows(exchange, userId))
    .filter((lock) => isWithinDateRange(lock.date, startDate, endDate));
}

export async function findActiveExchangeSlotLock({
  userId,
  date,
  shiftType,
  excludeExchangeId,
}: {
  userId: string;
  date: string;
  shiftType: ShiftType;
  excludeExchangeId?: string;
}): Promise<ExchangeSlotLock | null> {
  const locks = await getUserActiveExchangeSlotLocks({
    userId,
    startDate: date,
    endDate: date,
  });

  return (
    locks.find(
      (lock) =>
        lock.date === date &&
        lock.shiftType === shiftType &&
        lock.exchangeId !== excludeExchangeId,
    ) ?? null
  );
}

export async function getUserCalendarExchangeOverlayEntries({
  userId,
  startDate,
  endDate,
}: {
  userId: string;
  startDate: string;
  endDate: string;
}): Promise<CalendarExchangeOverlayEntry[]> {
  const locks = await getUserActiveExchangeSlotLocks({
    userId,
    startDate,
    endDate,
  });

  return locks.map((lock) => ({
    exchangeId: lock.exchangeId,
    date: lock.date,
    kind: lock.kind,
    shiftType: lock.shiftType,
  }));
}

export function isActiveExchangeSlotLockError(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}): boolean {
  if (error.code !== "23505") {
    return false;
  }

  const haystack = `${error.message ?? ""} ${error.details ?? ""}`;
  return (
    haystack.includes(ACTIVE_EXCHANGE_SHIFT_INDEX) ||
    haystack.includes(ACTIVE_EXCHANGE_COMPENSATION_INDEX)
  );
}
