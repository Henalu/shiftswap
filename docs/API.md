# Superficie tecnica - ShiftSwap

> Este proyecto no expone una API REST amplia de negocio. La mayor parte de la logica vive en Server Components, Server Actions y queries a Supabase desde el servidor.

## Modelo real de interaccion

- Paginas App Router para lectura y composicion de UI
- Server Actions para mutaciones
- Supabase como capa de datos, auth, realtime y storage
- Route Handler puntual para generacion de PDF corporativo

## Paginas principales

### Auth
- `/login`
- `/register`
- `/pending-validation`

### Dashboard
- `/shifts`
- `/shifts/new`
- `/shifts/[id]`
- `/shifts/my`
- `/chat`
- `/chat/[id]`
- `/exchanges`
- `/exchanges/[id]`
- `/profile`
- `/admin`
- `/admin/exchanges`
- `/admin/validations`
- `/admin/validations/[id]`
- `/admin/users`

## Route Handlers reales

### PDF corporativo del expediente
- Metodo: `GET`
- Ruta: `/api/exchanges/[id]/pdf`
- Uso: genera el PDF corporativo del cambio de turno en servidor
- Archivo: `src/app/api/exchanges/[id]/pdf/route.tsx`

## Server Actions principales

### Turnos
- `src/app/(dashboard)/shifts/new/actions.ts`
  - `createShift`
- `src/app/(dashboard)/shifts/my/actions.ts`
  - `acceptRequest`
  - `rejectRequest`
  - `cancelShift`
- `src/components/shifts/actions.ts`
  - `showInterest`

### Chat
- `src/app/(dashboard)/chat/actions.ts`
  - `startConversation`

### Exchanges
- `src/app/(dashboard)/exchanges/actions.ts`
  - `confirmExchange`
  - `attachExchangeDocument`
  - `signExchange`
  - `cancelExchange`
  - `requestSignedExchangeCancellation`
  - `confirmSignedExchangeCancellation`
  - `rejectSignedExchangeCancellation`

### Aprobacion de exchanges
- `src/app/(dashboard)/admin/exchanges/actions.ts`
  - `approveExchangeRequest`
  - `rejectExchangeRequest`

### Perfil
- `src/app/(dashboard)/profile/actions.ts`
  - `updateProfile`

### Admin
- `src/app/(dashboard)/admin/validations/actions.ts`
  - `approveUser`
  - `rejectUser`
- `src/app/(dashboard)/admin/users/actions.ts`
  - `changeUserRole`

## Realtime

### Tablas publicadas y usadas por cliente
- `messages`
- `notifications`

### Dependencias de migracion
- `00010_enable_realtime_for_messages.sql`
- `00013_notifications_center.sql`
- `00014_notification_center_state_and_dedupe.sql`

## Storage buckets relevantes

- `avatars`
- `exchange-documents`
- `id-cards`

## Entidades principales

- `user_profiles`
- `companies`
- `departments`
- `shifts`
- `shift_requests`
- `conversations`
- `messages`
- `exchanges`
- `exchange_events`
- `shift_debt_transactions`
- `notifications`

## Estados clave

### Shift
- `open`
- `pending`
- `confirmed`
- `completed`
- `cancelled`

### Shift request
- `pending`
- `accepted`
- `rejected`
- `withdrawn`

### Exchange
- `pending_confirmation`
- `confirmed`
- `pending_department_approval`
- `approved`
- `rejected`
- `completed`
- `cancelled`

### Compensation agreement
- `hours_bank`
- `shift_exchange`

### Shift debt transaction
- `pending_approval`
- `active`
- `voided`
- `settled`

## Notas tecnicas

- La UI usa `searchParams` para filtros en listings, no endpoints REST separados.
- La mayor parte de lecturas ocurren server-side con `createClient()` de Supabase.
- Las mutaciones importantes deben devolver `{ success: true }` para que la UI reaccione sin esperar un rerender completo.
- `createNotification` usa service role para poder insertar notificaciones de terceros sin depender de RLS del usuario autenticado.
- La logica de negocio del workflow ya no depende de descargar/subir documentos manualmente.
- El PDF es una salida generada por el sistema; el soporte documental externo es opcional.
- Para produccion, Supabase debe tener aplicadas las migraciones hasta `00019`.
