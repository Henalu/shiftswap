# Operacion y despliegue - ShiftSwap

## Objetivo

Dejar una base operativa realista para staging, piloto y produccion sin depender solo de memoria tribal del equipo.

## Entornos recomendados

- `local`: desarrollo diario
- `staging`: mismo flujo que produccion, con datos y claves separadas
- `production`: usuarios reales

## Minimo tecnico para staging y piloto

1. Confirmar que `staging` y `production` usan proyectos Supabase distintos, con claves, usuarios, Storage y Auth separados.
2. Aplicar migraciones de Supabase hasta la ultima migracion del repo. A 2026-06-02 la ultima es `20260602103814_lock_internal_billing_and_rate_limit_tables.sql`.
3. Revisar Supabase Auth en staging:
   - `Site URL` apunta al dominio de staging.
   - Redirect URLs incluyen el dominio de staging y los callbacks usados por login, reset password y email.
   - No se mezclan URLs de produccion en un proyecto de staging salvo que haya una razon operativa documentada.
4. Verificar el modelo de acceso de Storage antes de usar datos reales:
   - `id-cards` debe mantenerse privado.
   - `avatars`, `exchange-documents` y `signatures` existen actualmente como buckets publicos en las migraciones; aceptar explicitamente ese riesgo para piloto o planificar remediacion antes de cargar documentos/firma reales sensibles.
5. Confirmar que las tablas internas de billing y rate limit no quedan accesibles desde cliente:
   - `billing_accounts`
   - `billing_invoices`
   - `billing_plans`
   - `billing_subscriptions`
   - `billing_webhook_events`
   - `request_rate_limits`
6. Confirmar variables de entorno por entorno sin imprimir valores:
   - Supabase public URL y anon key.
   - Supabase service role solo server-side.
   - billing y Stripe solo server-side salvo flags publicos intencionados.
   - Turnstile y Resend con secretos solo server-side.
   - `NEXT_PUBLIC_APP_URL` alineada con el dominio del entorno.
7. Preparar fixture E2E local con credenciales no reales y documentadas fuera del repo.
8. No ejecutar scripts de fixture local contra staging ni produccion.
9. Confirmar gates locales antes de desplegar: `npm run typecheck`, `npm run lint`, `npm run build` y `npm run test:smoke`.
10. Ejecutar smoke contra staging con `E2E_BASE_URL` y `E2E_START_SERVER=0` cuando haya URL y credenciales E2E de staging.
11. Revisar `docs/SECURITY_BASELINE.md` antes de usar datos reales o abrir piloto.

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
- `E2E_DEPARTMENT_ADMIN_EMAIL`
- `E2E_DEPARTMENT_ADMIN_PASSWORD`
- `E2E_HR_ADMIN_EMAIL`
- `E2E_HR_ADMIN_PASSWORD`
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` como alias legacy local
- `E2E_SUPER_ADMIN_EMAIL`
- `E2E_SUPER_ADMIN_PASSWORD`
- `E2E_UNRELATED_EMAIL`
- `E2E_UNRELATED_PASSWORD`
- `E2E_EXCHANGE_ID`

Notas:

- Si no se define `E2E_BASE_URL`, Playwright levanta la app localmente.
- Si quieres usar un servidor ya abierto, define `E2E_START_SERVER=0`.
- Los smokes pueden leer credenciales y `E2E_EXCHANGE_ID` desde `.env.local`.
- Para staging, define `E2E_BASE_URL` con la URL del despliegue en el entorno que lanza Playwright y usa `E2E_START_SERVER=0`; las credenciales E2E deben venir del gestor de secretos o del entorno local no versionado.
- No reutilizar el fixture Auth local para poblar staging.
- El smoke siempre valida `GET /api/health`.
- Los bloques autenticados se saltan si faltan credenciales.
- Los negativos de permisos validan que un miembro no entra en `/admin/exchanges` ni `/admin/users`.
- Si `E2E_EXCHANGE_ID` y `E2E_UNRELATED_*` existen, tambien validan que un usuario sin relacion recibe 404 en ambos PDFs.

## Readiness de staging

Antes de invitar usuarios de piloto real, completar y guardar evidencia redacted fuera del repo:

- [ ] Proyecto Supabase de staging separado de produccion.
- [ ] App desplegada en dominio de staging.
- [ ] Migraciones aplicadas hasta la ultima de `supabase/migrations/`.
- [ ] Supabase Auth `Site URL` y Redirect URLs revisadas para staging.
- [ ] Tablas internas de billing/rate limit con RLS activo y sin grants para `anon`/`authenticated`.
- [ ] Buckets y politicas de Storage revisados, con decision explicita sobre buckets publicos actuales.
- [ ] Variables server-side configuradas sin imprimir secretos en logs, capturas ni documentos.
- [ ] `GET /api/health` responde en staging.
- [ ] Smoke anonimo y autenticado ejecutado contra staging.
- [ ] PDFs de expediente validados con un expediente E2E de staging.
- [ ] Rollback basico ensayado o documentado para app y base de datos.
- [ ] Pendientes de seguridad aceptados por responsable del piloto.

### Estado operativo revisado - 2026-06-02

- Supabase local arranca con la configuracion del repo: API `127.0.0.1:56321`, DB `127.0.0.1:56322`.
- Migraciones locales aplicadas hasta `20260602103814_lock_internal_billing_and_rate_limit_tables.sql`.
- `GET /api/health` responde `database: "up"` en local.
- Fixture E2E local ejecutado en modo commit; usuarios Auth reparados y rate limits de login reseteados.
- Smoke local ejecutado: 9/9 tests pasan sin skips.
- Smoke staging no ejecutado: falta `E2E_BASE_URL` en la configuracion disponible y `E2E_START_SERVER` no esta predefinido.
- Variables E2E de roles y `E2E_EXCHANGE_ID` aparecen presentes, sin exponer valores.
- Proximo paso: configurar `E2E_BASE_URL` para el dominio real de staging, ejecutar `npm run test:smoke` con `E2E_START_SERVER=0` y confirmar que las credenciales presentes son de staging, no del fixture local.
- Mantener bloqueado cualquier piloto con datos reales hasta resolver o aceptar explicitamente el estado actual de Storage: `id-cards` privado; `avatars`, `exchange-documents` y `signatures` publicos segun migraciones actuales.

## Fixture E2E local

```bash
npm run supabase:setup:e2e-auth
npm run supabase:setup:e2e-auth:commit
```

El primer comando es dry-run/`ROLLBACK` y no persiste cambios. El segundo crea o repara usuarios de Supabase Auth local y sus filas `user_profiles` para `member`, `department_admin`, `hr_admin` y `super_admin`.

Guardrails:

- Lee `.env.local` y variables de proceso.
- Exige `NEXT_PUBLIC_SUPABASE_URL` local.
- Usa una company/departamento ya presentes en seeds (`arcelor` o `empresa-demo`).
- No imprime passwords ni claves.
- No debe ejecutarse contra staging ni produccion.

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
- Rollback basico de app:
  - redeplegar el ultimo commit estable en Vercel
  - mantener variables de entorno sin cambios hasta confirmar si el fallo es de app o config
- Rollback basico de base de datos:
  - evitar cambios manuales en dashboard fuera de migraciones
  - para roturas destructivas, restaurar backup reciente de staging
  - para roturas no destructivas, aplicar migracion forward-fix o SQL rollback revisado
- Si una migracion rompe el entorno:
  - congelar despliegues
  - pausar acciones de usuarios si hay riesgo de integridad de datos
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
- Crear credenciales E2E de staging por rol sin datos reales
- Crear expediente E2E de staging para validar detalle y PDFs
- Conectar checks de uptime externos
- Definir politica formal de retencion de documentos
- Decidir si los buckets publicos actuales son aceptables para piloto o si hay que remediarlos antes de datos reales
- Revisar legales antes de activar cobro a terceros
