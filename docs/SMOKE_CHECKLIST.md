# Smoke checklist - ShiftSwap

## Alcance

Este documento cubre dos capas:

- smoke automatizado con Playwright
- smoke manual de punta a punta para staging y piloto

## Smoke automatizado

Comando:

```bash
npm run test:smoke
```

Cobertura base:

- `GET /api/health`
- login de miembro
- rutas clave de trabajo:
  - `/shifts`
  - `/shifts/new`
  - `/calendar`
  - `/calendar/vacations`
  - `/exchanges`
  - `/billing`
  - `/help`
  - `/profile`
- colas admin:
  - `/admin/exchanges`
  - `/admin/validations`
  - `/admin/department-changes`
  - `/admin/job-position-changes`
  - `/admin/schedule-config`
- `/admin/users` si existe credencial de super admin
- detalle y PDFs de un expediente si se define `E2E_EXCHANGE_ID`

Variables necesarias:

- `E2E_MEMBER_EMAIL`
- `E2E_MEMBER_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

Variables opcionales:

- `E2E_SUPER_ADMIN_EMAIL`
- `E2E_SUPER_ADMIN_PASSWORD`
- `E2E_EXCHANGE_ID`
- `E2E_BASE_URL`

## Smoke manual

### Auth

- Registro correcto con documentacion valida
- Rechazo por datos incompletos
- Login correcto
- Login con credenciales incorrectas
- Rate limit en login
- Forgot password
- Reset password

### Acceso y validacion

- Usuario `pending` redirige a `/pending-validation`
- Usuario `approved` entra al dashboard
- Admin aprueba cuenta
- Admin rechaza cuenta

### Turnos y propuestas

- Publicar turno
- Proponer `hours_bank`
- Proponer `shift_exchange`
- Aceptar propuesta
- Rechazar propuesta
- Abrir expediente resultante

### Expediente y aprobacion

- Firmar como solicitante
- Solicitar retirada cuando aplique
- Aprobar desde admin
- Rechazar desde admin
- Descargar `/api/exchanges/[id]/pdf`
- Descargar `/api/exchanges/[id]/official-pdf`

### Calendario

- `/calendar` muestra jornada
- `/calendar/vacations` permite alta y borrado de vacaciones
- `/admin/schedule-config` permite:
  - asignar tipo de jornada por area
  - asignar grupo de rotacion

### Billing

- `/billing` visible para usuario autenticado
- Checkout Stripe redirige correctamente
- Portal Stripe abre si existe customer
- Webhook actualiza suscripcion
- Usuario bloqueado por billing redirige a `/billing`
