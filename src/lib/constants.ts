import type {
  CalendarDayType,
  DepartmentChangeRequestStatus,
  ExchangeAgreementType,
  ExchangeStatus,
  RequestStatus,
  ShiftStatus,
  ShiftDebtTransactionStatus,
  ShiftType,
} from "@/types";

// ShiftSwap - Application Constants

export const SHIFT_TYPE_LABELS = {
  morning: "Manana",
  afternoon: "Tarde",
  night: "Noche",
  normal_full: "Jornada completa",
  normal_short: "Jornada reducida",
} as const satisfies Record<ShiftType, string>;

export const COMPENSATION_SHIFT_TYPE_LABELS = {
  ...SHIFT_TYPE_LABELS,
  rest: "Descanso",
} as const satisfies Record<ShiftType | "rest", string>;

export const SHIFT_TYPE_STYLES = {
  morning:
    "border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  afternoon:
    "border-violet-500/15 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  night:
    "border-slate-500/15 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  normal_full:
    "border-teal-500/15 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  normal_short:
    "border-cyan-500/15 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
} as const satisfies Record<ShiftType, string>;

export const COMPENSATION_SHIFT_TYPE_STYLES = {
  ...SHIFT_TYPE_STYLES,
  rest: "border-muted bg-muted/50 text-muted-foreground",
} as const satisfies Record<ShiftType | "rest", string>;

export const SHIFT_STATUS_LABELS = {
  open: "Disponible",
  negotiating: "En tramite",
  completed: "Completado",
  cancelled: "Cancelado",
  expired: "Caducado",
} as const satisfies Record<ShiftStatus, string>;

export const REQUEST_STATUS_LABELS = {
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  withdrawn: "Retirada",
} as const satisfies Record<RequestStatus, string>;

export const EXCHANGE_STATUS_LABELS = {
  accepted: "Aceptado",
  pending_validation: "Pendiente de validacion",
  approved: "Aprobado",
  rejected: "Rechazado",
  completed: "Completado",
  cancelled: "Cancelado",
  expired: "Caducado",
} as const satisfies Record<ExchangeStatus, string>;

export const SHIFT_STATUS_STYLES = {
  open:
    "border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  negotiating:
    "border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  completed:
    "border-slate-500/15 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  cancelled:
    "border-rose-500/15 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  expired:
    "border-slate-400/15 bg-slate-400/10 text-slate-500 dark:text-slate-400",
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
  accepted:
    "border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  pending_validation:
    "border-violet-500/15 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  approved:
    "border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected:
    "border-rose-500/15 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  completed:
    "border-slate-500/15 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  cancelled:
    "border-rose-500/15 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  expired:
    "border-slate-400/15 bg-slate-400/10 text-slate-500 dark:text-slate-400",
} as const satisfies Record<ExchangeStatus, string>;

export const EXCHANGE_AGREEMENT_LABELS = {
  hours_bank: "Bolsa de horas",
  shift_exchange: "Intercambio de turno",
} as const satisfies Record<ExchangeAgreementType, string>;

export const EXCHANGE_AGREEMENT_STYLES = {
  hours_bank:
    "border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  shift_exchange:
    "border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300",
} as const satisfies Record<ExchangeAgreementType, string>;

export const SHIFT_DEBT_TRANSACTION_STATUS_LABELS = {
  pending_approval: "Pendiente de aprobacion",
  active: "Pendiente de compensacion",
  voided: "Anulado",
  settled: "Compensado",
} as const satisfies Record<ShiftDebtTransactionStatus, string>;

export const SHIFT_DEBT_TRANSACTION_STATUS_STYLES = {
  pending_approval:
    "border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  active:
    "border-violet-500/15 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  voided:
    "border-rose-500/15 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  settled:
    "border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
} as const satisfies Record<ShiftDebtTransactionStatus, string>;

export const DEPARTMENT_CHANGE_REQUEST_STATUS_LABELS = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
} as const satisfies Record<DepartmentChangeRequestStatus, string>;

export const DEPARTMENT_CHANGE_REQUEST_STATUS_STYLES = {
  pending:
    "border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  approved:
    "border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected:
    "border-rose-500/15 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  cancelled:
    "border-slate-500/15 bg-slate-500/10 text-slate-700 dark:text-slate-300",
} as const satisfies Record<DepartmentChangeRequestStatus, string>;

export const CALENDAR_DAY_TYPE_LABELS = {
  morning: "Manana",
  afternoon: "Tarde",
  night: "Noche",
  rest: "Descanso",
  normal_full: "Jornada completa",
  normal_short: "Jornada reducida",
  vacation: "Vacaciones",
} as const satisfies Record<CalendarDayType, string>;

export const CALENDAR_DAY_TYPE_STYLES = {
  morning:
    "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20",
  afternoon:
    "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
  night:
    "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
  rest:
    "bg-muted/50 text-muted-foreground border-muted",
  normal_full:
    "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20",
  normal_short:
    "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
  vacation:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
} as const satisfies Record<CalendarDayType, string>;

export const CALENDAR_DAY_TYPE_DOT_COLORS = {
  morning: "bg-sky-500",
  afternoon: "bg-violet-500",
  night: "bg-slate-500",
  rest: "bg-muted-foreground/30",
  normal_full: "bg-teal-500",
  normal_short: "bg-cyan-500",
  vacation: "bg-emerald-500",
} as const satisfies Record<CalendarDayType, string>;

export const ROTATION_GROUP_LABELS: Record<string, string> = {
  A: "Grupo A",
  B: "Grupo B",
  C: "Grupo C",
  D: "Grupo D",
  E: "Grupo E",
};

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_SHIFTS_PER_DAY = 3;
