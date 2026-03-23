import type {
  ExchangeStatus,
  RequestStatus,
  ShiftStatus,
  ShiftType,
} from "@/types";

// ShiftSwap - Application Constants

export const SHIFT_TYPE_LABELS = {
  morning: "Manana",
  afternoon: "Tarde",
  night: "Noche",
} as const satisfies Record<ShiftType, string>;

export const SHIFT_TYPE_STYLES = {
  morning:
    "border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  afternoon:
    "border-violet-500/15 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  night:
    "border-slate-500/15 bg-slate-500/10 text-slate-700 dark:text-slate-300",
} as const satisfies Record<ShiftType, string>;

export const SHIFT_STATUS_LABELS = {
  open: "Disponible",
  pending: "En negociacion",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled: "Cancelado",
} as const satisfies Record<ShiftStatus, string>;

export const REQUEST_STATUS_LABELS = {
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  withdrawn: "Retirada",
} as const satisfies Record<RequestStatus, string>;

export const EXCHANGE_STATUS_LABELS = {
  pending_confirmation: "Pendiente de confirmacion",
  confirmed: "Confirmado",
  signed: "Firmado",
  completed: "Completado",
  cancelled: "Cancelado",
} as const satisfies Record<ExchangeStatus, string>;

export const SHIFT_STATUS_STYLES = {
  open:
    "border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  pending:
    "border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  confirmed:
    "border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  completed:
    "border-slate-500/15 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  cancelled:
    "border-rose-500/15 bg-rose-500/10 text-rose-700 dark:text-rose-300",
} as const satisfies Record<ShiftStatus, string>;

export const REQUEST_STATUS_STYLES = {
  pending:
    "border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  accepted:
    "border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected:
    "border-rose-500/15 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  withdrawn:
    "border-slate-500/15 bg-slate-500/10 text-slate-700 dark:text-slate-300",
} as const satisfies Record<RequestStatus, string>;

export const EXCHANGE_STATUS_STYLES = {
  pending_confirmation:
    "border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  confirmed:
    "border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  signed:
    "border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  completed:
    "border-slate-500/15 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  cancelled:
    "border-rose-500/15 bg-rose-500/10 text-rose-700 dark:text-rose-300",
} as const satisfies Record<ExchangeStatus, string>;

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_SHIFTS_PER_DAY = 3;
