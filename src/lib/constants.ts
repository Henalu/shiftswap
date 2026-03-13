// ShiftSwap — Application Constants

export const SHIFT_TYPE_LABELS = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  night: 'Noche',
} as const;

export const SHIFT_STATUS_LABELS = {
  open: 'Disponible',
  pending: 'En negociación',
  confirmed: 'Confirmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
} as const;

export const REQUEST_STATUS_LABELS = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  withdrawn: 'Retirada',
} as const;

export const EXCHANGE_STATUS_LABELS = {
  pending_confirmation: 'Pendiente de confirmación',
  confirmed: 'Confirmado',
  signed: 'Firmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
} as const;

export const SHIFT_STATUS_COLORS = {
  open: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
} as const;

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_SHIFTS_PER_DAY = 3;
