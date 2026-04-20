# Superficie tecnica - ShiftSwap

La mayor parte de la logica de negocio vive en Server Components, Server Actions y Supabase. No existe una API REST amplia de dominio.

## Modelo real de interaccion

- Paginas App Router para lectura y composicion
- Server Actions para mutaciones
- Route Handlers puntuales para PDF, billing y health
- Supabase como auth, datos, storage y realtime

## Paginas principales

### Auth y acceso

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/pending-validation`
- `/billing`

### Dashboard

- `/shifts`
- `/shifts/new`
- `/shifts/[id]`
- `/shifts/my`
- `/calendar`
- `/calendar/vacations`
- `/chat`
- `/chat/[id]`
- `/exchanges`
- `/exchanges/[id]`
- `/profile`
- `/help`

### Admin

- `/admin`
- `/admin/exchanges`
- `/admin/validations`
- `/admin/validations/[id]`
- `/admin/department-changes`
- `/admin/job-position-changes`
- `/admin/schedule-config`
- `/admin/users`

## Route Handlers reales

### PDFs

- `GET /api/exchanges/[id]/pdf`
- `GET /api/exchanges/[id]/official-pdf`

### Billing

- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `POST /api/billing/webhooks/stripe`

### Operacion

- `GET /api/health`

## Server Actions principales

### Auth

- `src/app/(auth)/login/actions.ts`
  - `loginWithPassword`
- `src/app/(auth)/register/actions.ts`
  - `registerEmployee`
- `src/app/(auth)/forgot-password/actions.ts`
  - `sendPasswordResetEmail`

### Turnos y propuestas

- `src/app/(dashboard)/shifts/new/actions.ts`
  - `createShift`
- `src/app/(dashboard)/shifts/my/actions.ts`
  - `acceptProposal`
  - `rejectProposal`
- `src/components/shifts/actions.ts`
  - `proposeExchange`
  - `withdrawProposal`
  - `cancelShift`

### Chat

- `src/app/(dashboard)/chat/actions.ts`
  - `startConversation`

### Expedientes

- `src/app/(dashboard)/exchanges/actions.ts`
  - `signAsInterested`
  - `attachExchangeDocument`
  - `requestSignedExchangeCancellation`
  - `confirmSignedExchangeCancellation`
  - `rejectSignedExchangeCancellation`
  - `cancelExchange`

### Aprobacion departamental

- `src/app/(dashboard)/admin/exchanges/actions.ts`
  - `approveExchangeRequest`
  - `rejectExchangeRequest`

### Perfil y onboarding

- `src/app/(dashboard)/profile/actions.ts`
  - `updateSignatureUrl`
  - `updateProfile`
  - `requestDepartmentChange`
  - `requestJobPositionChange`
- `src/app/(dashboard)/onboarding-actions.ts`
  - `completeOnboarding`

### Calendario

- `src/app/(dashboard)/calendar/vacations/actions.ts`
  - `createVacation`
  - `deleteVacation`
- `src/app/(dashboard)/admin/schedule-config/actions.ts`
  - `setAreaScheduleType`
  - `assignUserRotationGroup`

### Admin adicional

- `src/app/(dashboard)/admin/validations/actions.ts`
  - `approveUser`
  - `rejectUser`
- `src/app/(dashboard)/admin/users/actions.ts`
  - `changeUserRole`
- `src/app/(dashboard)/admin/department-changes/actions.ts`
  - `approveDepartmentChangeRequest`
  - `rejectDepartmentChangeRequest`
- `src/app/(dashboard)/admin/job-position-changes/actions.ts`
  - `approveJobPositionChangeRequest`
  - `rejectJobPositionChangeRequest`

## Realtime

### Tablas publicadas

- `messages`
- `notifications`

### Dependencias minimas

- `00010_enable_realtime_for_messages.sql`
- `00013_notifications_center.sql`
- `00014_notification_center_state_and_dedupe.sql`

## Storage buckets relevantes

- `avatars`
- `exchange-documents`
- `id-cards`
- `signatures`

## Entidades principales

- `user_profiles`
- `companies`
- `departments`
- `job_positions`
- `shifts`
- `shift_requests`
- `conversations`
- `messages`
- `exchanges`
- `exchange_events`
- `shift_debt_transactions`
- `department_change_requests`
- `job_position_change_requests`
- `notifications`
- `billing_accounts`
- `billing_subscriptions`
- `rotation_patterns`
- `rotation_groups`
- `area_schedule_configs`
- `user_rotation_assignments`
- `vacations`
- `schedule_overrides`

## Estados clave

### Shift

- `open`
- `negotiating`
- `completed`
- `cancelled`
- `expired`

### Shift request

- `pending`
- `accepted`
- `rejected`
- `withdrawn`

### Exchange

- `accepted`
- `pending_validation`
- `approved`
- `rejected`
- `completed`
- `cancelled`
- `expired`

### Compensation agreement

- `hours_bank`
- `shift_exchange`

### Calendar day type

- `morning`
- `afternoon`
- `night`
- `rest`
- `normal_full`
- `normal_short`
- `vacation`

## Notas tecnicas

- El flujo vivo ya es v2: propuesta directa, aceptacion por el publicador y firma explicita solo del solicitante.
- `createNotification` usa service role para insertar notificaciones de terceros sin depender de RLS del usuario autenticado.
- `src/lib/billing.ts` centraliza el estado comercial efectivo.
- `src/lib/calendar.ts` valida calendario base, overrides y vacaciones.
- `src/lib/calendar-data.ts` usa admin client para evitar problemas con column-level grants.
- Los PDFs son una salida generada por el sistema; el soporte documental externo es opcional.
- Para staging y piloto la base debe tener aplicadas las migraciones hasta `00030`.
