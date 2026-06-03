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

Preparacion local recomendada:

```bash
npm run supabase:start
npx supabase migration up --local
npm run supabase:setup:e2e-auth
npm run supabase:setup:e2e-auth:commit
npm run test:smoke
```

El Supabase local del repo usa API `http://127.0.0.1:56321` y DB `127.0.0.1:56322`. Si `E2E_BASE_URL` esta vacio, Playwright levanta Next en `E2E_PORT` o `3001` y espera a `/api/health`.

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
- catalogo billing B2C:
  - importes early adopter
  - solo planes publicos `owner_type = user`
  - ningun plan publico `owner_type = company`
- colas admin:
  - `/admin/exchanges`
  - `/admin/validations`
  - `/admin/department-changes`
  - `/admin/job-position-changes`
  - `/admin/schedule-config`
- `/admin/users` si existe credencial de super admin
- `/admin/platform` si existe credencial de super admin
- detalle y PDFs de un expediente si se define `E2E_EXCHANGE_ID`
- negativos de permisos:
  - miembro autenticado redirige fuera de `/admin/exchanges`
  - miembro autenticado redirige fuera de `/admin/users`
  - usuario `E2E_UNRELATED_*` no puede descargar PDFs de `E2E_EXCHANGE_ID`

Variables necesarias:

- `E2E_MEMBER_EMAIL`
- `E2E_MEMBER_PASSWORD`
- `E2E_DEPARTMENT_ADMIN_EMAIL`
- `E2E_DEPARTMENT_ADMIN_PASSWORD`
- `E2E_HR_ADMIN_EMAIL`
- `E2E_HR_ADMIN_PASSWORD`

Variables opcionales:

- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` como alias legacy de admin departamental local
- `E2E_SUPER_ADMIN_EMAIL`
- `E2E_SUPER_ADMIN_PASSWORD`
- `E2E_UNRELATED_EMAIL`
- `E2E_UNRELATED_PASSWORD`
- `E2E_EXCHANGE_ID`
- `E2E_BASE_URL`
- `E2E_PORT`
- `E2E_START_SERVER`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Notas:

- Las credenciales y `E2E_EXCHANGE_ID` pueden leerse desde `.env.local`; `E2E_BASE_URL` y `E2E_START_SERVER` deben estar disponibles en el entorno del proceso que lanza Playwright.
- Si `E2E_BASE_URL` esta vacio, Playwright conserva el comportamiento historico de levantar Next en `E2E_PORT` o `3001`.
- El smoke de catalogo billing usa `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. En staging deben apuntar al proyecto staging; si `E2E_BASE_URL` es remoto pero Supabase apunta a local, ese bloque se salta para evitar un falso verde.
- Usa `E2E_START_SERVER=0` cuando ya tengas `npm run dev` abierto y quieras evitar que Playwright arranque otro servidor.
- Para crear o reparar usuarios E2E locales, ejecuta `npm run supabase:setup:e2e-auth` primero. Es dry-run/`ROLLBACK` por defecto.
- Persiste el fixture solo con `npm run supabase:setup:e2e-auth:commit`. El script se bloquea si Supabase no apunta a local.
- Los bloques autenticados se saltan si faltan credenciales. El smoke negativo de PDFs se salta si falta `E2E_EXCHANGE_ID` o `E2E_UNRELATED_*`.

## Smoke contra staging

Requisitos:

- App desplegada en el dominio de staging.
- Supabase staging separado de produccion y migrado hasta la ultima migracion del repo.
- Supabase Auth con `Site URL` y Redirect URLs apuntando a staging.
- Credenciales E2E de staging por rol, guardadas fuera del repo.
- `E2E_EXCHANGE_ID` de un expediente de staging preparado para abrir detalle y descargar ambos PDFs.

Ejecucion:

```bash
E2E_BASE_URL=<staging-url> E2E_START_SERVER=0 npm run test:smoke
```

En PowerShell, definir las variables en la sesion antes de ejecutar:

```powershell
$env:E2E_BASE_URL="<staging-url>"
$env:E2E_START_SERVER="0"
npm run test:smoke
```

Guardrails:

- No ejecutar `npm run supabase:setup:e2e-auth` ni `npm run supabase:setup:e2e-auth:commit` contra staging.
- No imprimir valores de variables E2E, claves Supabase, service role, Stripe, Turnstile ni Resend.
- Si falta una credencial de rol, el bloque correspondiente puede saltarse; para readiness de piloto real, documentar ese skip como pendiente.
- Guardar evidencia redacted fuera del repo si contiene datos personales, emails reales o documentos.

## Estado local de readiness - 2026-06-03

- Supabase local verificado: migraciones aplicadas hasta `20260602130533_set_b2c_launch_pricing.sql` y `/api/health` responde `database: "up"`.
- Fixture E2E local listo: dry-run y commit ejecutados contra Supabase local; usuarios E2E reparados sin cambios pendientes de perfil y buckets de rate limit de login reseteados.
- Expediente exportable listo: `E2E_EXCHANGE_ID=3e778f9b-7f6b-49ba-a2de-010a5d5e2434` abre el detalle y responde con PDF ShiftSwap y PDF oficial.
- Smoke local ejecutado: 10/10 tests pasan. Cubre rutas de miembro, catalogo billing B2C, colas admin, gestion de usuarios super admin, expediente/PDFs, negativos de permisos y health.
- Skips restantes: ninguno en la pasada local con credenciales completas.
- Warning no bloqueante: Next sigue avisando sobre `scroll-behavior: smooth` en `<html>` durante el smoke. No afecta a readiness funcional; resolver con `data-scroll-behavior="smooth"` solo si se toca el layout global.

## Estado staging/piloto - 2026-06-02

- Smoke contra staging: bloqueado; no se ha ejecutado en esta revision para evitar caer en local por accidente.
- Configuracion smoke revisada sin imprimir valores:
  - `E2E_BASE_URL`: falta
  - `E2E_START_SERVER`: falta
  - `E2E_MEMBER_EMAIL` / `E2E_MEMBER_PASSWORD`: presente
  - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`: presente
  - `E2E_SUPER_ADMIN_EMAIL` / `E2E_SUPER_ADMIN_PASSWORD`: presente
  - `E2E_EXCHANGE_ID`: presente
- Pendiente: provisionar o confirmar staging real separado de produccion.
- Pendiente: aplicar o confirmar migraciones hasta la ultima de `supabase/migrations/`.
- Pendiente: revisar Redirect URLs de Supabase Auth para staging.
- Pendiente: configurar `E2E_BASE_URL` con el dominio de staging y ejecutar siempre con `E2E_START_SERVER=0`.
- Pendiente: confirmar que las credenciales y el expediente E2E presentes pertenecen a staging, no al fixture local.
- Pendiente: ejecutar `npm run test:smoke` contra staging con `E2E_START_SERVER=0`.
- Pendiente: documentar resultado final del piloto con skips, incidencias y decision sobre buckets publicos actuales.

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
- `/admin/platform` visible solo para super admin
- Checkout Stripe redirige correctamente
- Portal Stripe abre si existe customer
- Webhook actualiza suscripcion
- Usuario bloqueado por billing redirige a `/billing`
