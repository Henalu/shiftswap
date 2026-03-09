// ShiftSwap — Application Constants

export const APP_NAME = 'ShiftSwap';
export const APP_DESCRIPTION = 'Plataforma de intercambio de turnos entre empleados';

// Shift types with labels (Spanish UI)
export const SHIFT_TYPE_LABELS = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  night: 'Noche',
} as const;

// Shift status labels
export const SHIFT_STATUS_LABELS = {
  open: 'Disponible',
  pending: 'En negociación',
  confirmed: 'Confirmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
} as const;

// Request status labels
export const REQUEST_STATUS_LABELS = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  withdrawn: 'Retirada',
} as const;

// Exchange status labels
export const EXCHANGE_STATUS_LABELS = {
  pending_confirmation: 'Pendiente de confirmación',
  confirmed: 'Confirmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
} as const;

// Shift status colors (Tailwind classes)
export const SHIFT_STATUS_COLORS = {
  open: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
} as const;

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

// Limits
export const MAX_SHIFTS_PER_DAY = 3;
export const MAX_ACTIVE_SHIFTS = 10;
export const MAX_MESSAGE_LENGTH = 1000;
