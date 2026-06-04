import {
  COMPENSATION_SHIFT_TYPE_LABELS,
  EXCHANGE_AGREEMENT_LABELS,
  SHIFT_DEBT_TRANSACTION_STATUS_LABELS,
} from "@/lib/constants";
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

  if (
    exchangeStatus === "rejected" ||
    exchangeStatus === "cancelled" ||
    exchangeStatus === "expired"
  ) {
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
  compensationShiftType?: ShiftType | "rest" | null;
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
    ? COMPENSATION_SHIFT_TYPE_LABELS[compensationShiftType]
    : "turno pendiente";
  const dateLabel =
    formatCompensationDateLabel(compensationShiftDate) ?? "fecha pendiente";
  const compensationSummary =
    compensationShiftType === "rest"
      ? `descanso del ${dateLabel}`
      : `turno de ${shiftLabel} del ${dateLabel}`;

  return `${EXCHANGE_AGREEMENT_LABELS.shift_exchange}: compensacion acordada para el ${compensationSummary}.`;
}

export function getCompensationShiftTypeLabel(
  value: ShiftType | "rest" | null | undefined
): string {
  if (!value) {
    return "";
  }

  return COMPENSATION_SHIFT_TYPE_LABELS[value] ?? value;
}

export function getHoursBankDescription(
  debtorName: string,
  creditorName: string,
  units = 1,
): string {
  return `${debtorName} queda debiendo ${units} hora${
    units === 1 ? "" : "s"
  } a ${creditorName} dentro de la bolsa de horas.`;
}

export function getShiftDebtStatusLabel(
  status: ShiftDebtTransactionStatus
): string {
  return SHIFT_DEBT_TRANSACTION_STATUS_LABELS[status];
}
