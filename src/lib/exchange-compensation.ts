import {
  EXCHANGE_AGREEMENT_LABELS,
  SHIFT_DEBT_TRANSACTION_STATUS_LABELS,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ExchangeAgreementType,
  ExchangeStatus,
  ShiftDebtTransactionStatus,
  ShiftType,
} from "@/types";

const MADRID_TIMEZONE = "Europe/Madrid";

export function formatCompensationDateLabel(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function isExchangeAgreementType(
  value: string | null | undefined
): value is ExchangeAgreementType {
  return value === "hours_bank" || value === "shift_exchange";
}

export function isShiftType(value: string | null | undefined): value is ShiftType {
  return value === "morning" || value === "afternoon" || value === "night";
}

export function getMadridDateInputValue(baseDate: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MADRID_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(baseDate);
}

export function getMinimumCompensationDate(baseDate: Date = new Date()): string {
  const madridDate = getMadridDateInputValue(baseDate);
  const [year, month, day] = madridDate.split("-").map(Number);
  const nextDate = new Date(year, (month ?? 1) - 1, day ?? 1);

  nextDate.setDate(nextDate.getDate() + 1);

  const nextYear = nextDate.getFullYear();
  const nextMonth = `${nextDate.getMonth() + 1}`.padStart(2, "0");
  const nextDay = `${nextDate.getDate()}`.padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function isCompensationDateValid(
  compensationDate: string,
  minimumDate: string
): boolean {
  return compensationDate >= minimumDate;
}

export function getHoursBankTransactionStatusForExchange(
  exchangeStatus: ExchangeStatus
): ShiftDebtTransactionStatus {
  if (exchangeStatus === "approved" || exchangeStatus === "completed") {
    return "active";
  }

  if (exchangeStatus === "rejected" || exchangeStatus === "cancelled") {
    return "voided";
  }

  return "pending_approval";
}

export function getAgreementSummary({
  agreementType,
  compensationShiftType,
  compensationShiftDate,
  ownerName,
  requesterName,
}: {
  agreementType: ExchangeAgreementType | null | undefined;
  compensationShiftType?: ShiftType | null;
  compensationShiftDate?: string | null;
  ownerName: string;
  requesterName: string;
}): string {
  if (!agreementType) {
    return "Pendiente de definir por la persona interesada.";
  }

  if (agreementType === "hours_bank") {
    return `${EXCHANGE_AGREEMENT_LABELS.hours_bank}: ${ownerName} quedara debiendo 1 turno a ${requesterName}.`;
  }

  const shiftLabel = compensationShiftType
    ? SHIFT_TYPE_LABELS[compensationShiftType]
    : "turno pendiente";
  const dateLabel =
    formatCompensationDateLabel(compensationShiftDate) ?? "fecha pendiente";

  return `${EXCHANGE_AGREEMENT_LABELS.shift_exchange}: compensacion acordada para el turno de ${shiftLabel} del ${dateLabel}.`;
}

export function getHoursBankDescription(
  debtorName: string,
  creditorName: string
): string {
  return `${debtorName} queda debiendo 1 turno a ${creditorName} dentro de la bolsa de horas.`;
}

export function getShiftDebtStatusLabel(
  status: ShiftDebtTransactionStatus
): string {
  return SHIFT_DEBT_TRANSACTION_STATUS_LABELS[status];
}

export async function upsertHoursBankDebtTransaction({
  exchangeId,
  exchangeStatus,
  debtorUserId,
  creditorUserId,
  debtorName,
  creditorName,
}: {
  exchangeId: string;
  exchangeStatus: ExchangeStatus;
  debtorUserId: string;
  creditorUserId: string;
  debtorName: string;
  creditorName: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const status = getHoursBankTransactionStatusForExchange(exchangeStatus);
  const now = new Date().toISOString();
  const { error } = await supabase.from("shift_debt_transactions").upsert(
    {
      exchange_id: exchangeId,
      debtor_user_id: debtorUserId,
      creditor_user_id: creditorUserId,
      movement_type: "hours_bank_debt",
      units: 1,
      status,
      description: getHoursBankDescription(debtorName, creditorName),
      metadata: {
        agreement_type: "hours_bank",
      },
      approved_at: status === "active" ? now : null,
      voided_at: status === "voided" ? now : null,
    },
    {
      onConflict: "exchange_id",
    }
  );

  if (error) {
    console.error("[exchange-compensation] Failed to upsert debt transaction", {
      exchangeId,
      message: error.message,
    });
  }
}

export async function syncHoursBankDebtTransactionStatus(
  exchangeId: string,
  status: ShiftDebtTransactionStatus
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("shift_debt_transactions")
    .update({
      status,
      approved_at: status === "active" ? now : null,
      voided_at: status === "voided" ? now : null,
    })
    .eq("exchange_id", exchangeId);

  if (error) {
    console.error("[exchange-compensation] Failed to sync debt transaction", {
      exchangeId,
      status,
      message: error.message,
    });
  }
}
