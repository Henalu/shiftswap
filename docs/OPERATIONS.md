# Operacion y despliegue - ShiftSwap

## Objetivo

Dejar una base operativa realista para staging, piloto y produccion sin depender solo de memoria tribal del equipo.

## Entornos recomendados

- `local`: desarrollo diario
- `staging`: mismo flujo que produccion, con datos y claves separadas
- `production`: usuarios reales

## Minimo tecnico para staging y piloto

1. Aplicar migraciones de Supabase hasta `00030_calendar_rotation_and_vacations.sql`.
2. Confirmar proyectos Supabase distintos para `staging` y `production`.
3. Verificar buckets:
   - `avatars`
   - `exchange-documents`
   - `id-cards`
   - `signatures`
4. Confirmar variables de entorno:
   - Supabase
   - billing
   - Turnstile
   - Resend
5. Confirmar `npm run build`, `npm run lint` y `npm run test:smoke`.

## Checklist de despliegue

### Acceso y auth

- login
- register
- forgot password
- reset password
- pending validation

### Flujo operativo

- publicar turno
- proponer `hours_bank`
- aceptar propuesta
- firmar expediente
- aprobar o rechazar desde admin
- descargar PDF corporativo
- descargar PDF oficial

### Organizacion y calendario

- perfil con empresa, area, departamento y puesto
- cambios de departamento y puesto
- `/calendar`
- `/calendar/vacations`
- `/admin/schedule-config`

### Billing

- `/billing`
- checkout
- portal
- webhook Stripe

### Operacion publica

- `GET /api/health`

## Smoke automatizado

```bash
npm run test:smoke
```

Variables utiles:

- `E2E_MEMBER_EMAIL`
- `E2E_MEMBER_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_SUPER_ADMIN_EMAIL`
- `E2E_SUPER_ADMIN_PASSWORD`
- `E2E_EXCHANGE_ID`

Notas:

- Si no se define `E2E_BASE_URL`, Playwright levanta la app localmente.
- El smoke siempre valida `GET /api/health`.
- Los bloques autenticados se saltan si faltan credenciales.

## Observabilidad minima recomendada

- Uptime check contra `GET /api/health`
- Alertas de build fallido en Vercel
- Revision periodica de logs de:
  - auth
  - billing
  - webhooks Stripe
  - errores de Supabase
- Registro de incidencias del piloto con fecha, entorno y ruta afectada

## Backups y rollback

- Mantener backups automaticos de Supabase activados.
- Antes de cada despliegue sensible:
  - verificar backup reciente
  - registrar la ultima migracion objetivo
  - guardar referencia del commit desplegado
- Si una migracion rompe el entorno:
  - congelar despliegues
  - restaurar backup o aplicar rollback SQL validado
  - registrar el incidente en el changelog operativo

## Rotacion de claves

- Rotar periodicamente:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `TURNSTILE_SECRET_KEY`
  - `RESEND_API_KEY`
- Tras cada rotacion:
  - actualizar el proveedor del entorno
  - revalidar `GET /api/health`
  - rerun de `npm run test:smoke` si el entorno es accesible

## Pendientes fuera del repo

- Provisionar staging real si aun no existe
- Conectar checks de uptime externos
- Definir politica formal de retencion de documentos
- Revisar legales antes de activar cobro a terceros
