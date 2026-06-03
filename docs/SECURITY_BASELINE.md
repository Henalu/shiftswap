# Security baseline - ShiftSwap

Estado: adaptado desde aprendizajes de BoxOps para la preparacion de piloto de ShiftSwap.

Este documento no sustituye una auditoria profesional. Sirve como gate minimo antes de staging, piloto real, datos personales reales ampliados, billing activo o cambios en flujos criticos.

## Postura actual

ShiftSwap ya tiene buenas bases:

- Auth SSR con Supabase y validacion manual de empleados.
- RLS en tablas principales.
- Roles separados: `member`, `department_admin`, `hr_admin`, `super_admin`.
- Rate limiting server-side en login/registro y Turnstile opcional.
- Storage para firmas, avatares, documentos de expediente e identificacion.
- Webhook de Stripe con verificacion de firma.
- Smoke Playwright para health, rutas miembro, rutas admin, PDFs y negativos de permisos.

La deuda principal no es una pieza aislada. Es convertir seguridad, privacidad y readiness en una comprobacion repetible, no en memoria del turno.

## Gates por feature

Antes de cerrar cualquier feature que lea o escriba datos de empresa, turnos, expedientes, documentos, firmas, billing o datos personales:

1. Clasificar datos: operativo, personal visible, documento privado, firma, billing o auditoria.
2. Revalidar sesion, perfil, rol, empresa y departamento en servidor antes de mutar.
3. Verificar que cada ID recibido del cliente pertenece al alcance del actor.
4. Mantener RLS como segundo candado, no como sustituto de Server Actions.
5. Usar `createAdminClient()` solo en servidor y con motivo claro.
6. No exponer signed URLs largas, rutas internas de Storage, tokens o payloads sensibles en cliente, logs o screenshots.
7. Al anadir columnas a `user_profiles`, revisar column-level grants.
8. Las notificaciones accionables deben llevar `data.action_url` y `dedupe_key` cuando aplique.
9. Para rutas protegidas, mantener `Cache-Control: no-store`.
10. Si hay riesgo de permiso, anadir smoke, SQL rollback o verificacion negativa.

## Gates antes de piloto

Antes de invitar usuarios no tecnicos:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:smoke`
- `npm audit --omit=dev --audit-level=high` revisado o excepciones documentadas
- `npx supabase db advisors --local --type security --level warn --fail-on none` revisado o excepciones documentadas
- `npm run supabase:setup:e2e-auth` ejecutado como dry-run/`ROLLBACK` en local antes de persistir fixtures
- Supabase staging separado de produccion
- Redirect URLs de Supabase Auth revisadas
- buckets y politicas revisados: `avatars`, `exchange-documents`, `id-cards`, `signatures`
- `SUPABASE_SERVICE_ROLE_KEY`, Stripe, Turnstile y Resend configurados solo server-side
- credenciales E2E por rol disponibles fuera del repo
- smoke anonimo y autenticado ejecutado contra staging
- rollback de migraciones sensibles definido
- evidencia redacted guardada fuera del repo si contiene datos reales

## Gate staging/piloto real

Checklist especifico para pasar de readiness local a staging operativo:

- Supabase staging separado de produccion, con proyecto, claves, Auth y Storage propios.
- Migraciones aplicadas hasta la ultima de `supabase/migrations/`; a 2026-06-02, `20260602130533_set_b2c_launch_pricing.sql`.
- Supabase Auth revisado: `Site URL`, Redirect URLs y reset password apuntan a staging.
- Variables server-side configuradas en el proveedor sin imprimir valores:
  - service role
  - Stripe secret y webhook secret
  - Turnstile secret
  - Resend API key
- Variables publicas revisadas para que solo expongan valores intencionadamente publicos.
- Buckets revisados antes de cargar datos reales:
  - `id-cards` privado.
  - `avatars`, `exchange-documents` y `signatures` son publicos en el estado actual; esto requiere aceptacion explicita para piloto o remediacion previa.
- Smoke contra staging ejecutado con `E2E_BASE_URL` y `E2E_START_SERVER=0`.
- Fixture local E2E no ejecutado contra staging.
- Rollback basico documentado:
  - redeploy del ultimo commit estable para app
  - backup reciente o SQL rollback revisado para base de datos
  - congelar despliegues si hay riesgo de integridad
- Pendientes de piloto registrados con responsable y decision: aceptar, bloquear o mover fuera de alcance.

Estado 2026-06-02:

- Gate no superado: smoke staging bloqueado por falta de `E2E_BASE_URL` en la configuracion disponible.
- `E2E_START_SERVER` debe forzarse a `0` al ejecutar contra staging para no arrancar fixture local.
- Credenciales E2E de miembro, admin, super admin y `E2E_EXCHANGE_ID` aparecen presentes, sin imprimir valores; antes de ejecutar staging hay que confirmar que pertenecen a staging.
- Local verificado: tablas internas de billing/rate limit con RLS activo, sin grants directos para `anon`/`authenticated`, y smoke 10/10 pasando.
- `npm audit --omit=dev --audit-level=high` pasa sin vulnerabilidades high/critical. Quedan 2 moderadas de `postcss` transitivo en Next; `npm audit fix --force` propone un downgrade rompedor, asi que se deja para seguimiento upstream.
- Advisor local pendiente no bloqueante para piloto interno: `update_updated_at` y `apply_shift_schedule` tienen `search_path` mutable. Revisar antes de produccion o de ampliar superficie publica.
- No abrir piloto con datos reales sin decision explicita sobre buckets: `id-cards` privado; `avatars`, `exchange-documents` y `signatures` publicos en el estado actual.

## Service role

Regla operativa:

- `SUPABASE_SERVICE_ROLE_KEY` solo se lee en `src/lib/supabase/admin.ts`.
- No usar service role en Client Components.
- No usar service role para saltarse permisos que puedan validarse con usuario + RLS.
- Si una accion usa admin client, debe seguir validando actor, rol y alcance antes de escribir.

## Storage y documentos

- Los documentos y firmas no deben depender de URLs publicas persistentes.
- Preferir rutas backend o signed URLs cortas para descargas/preview.
- No guardar documentos reales sensibles en seeds, fixtures o screenshots.
- Las firmas guardadas en perfil son assets reutilizables; un expediente firmado debe conservar evidencia/snapshot propio cuando aplique.

## Local y smoke

- `.env.local` queda ignorado por git y los smokes ya pueden leer credenciales desde ahi.
- `npm run supabase:reset` queda bloqueado por defecto para proteger `auth.users` y datos locales manuales.
- Usar `npm run supabase:reset:danger` solo cuando se quiera reconstruir la base local.
- `npm run supabase:setup:e2e-auth` prepara el fixture Auth local en modo dry-run/`ROLLBACK`.
- Persistir usuarios E2E requiere `npm run supabase:setup:e2e-auth:commit` y URL local de Supabase.
- Si `E2E_BASE_URL` esta vacio, el smoke conserva el comportamiento historico de arrancar dev server. Set `E2E_START_SERVER=0` para usar un servidor ya abierto.
- Los smokes negativos deben saltarse, no fallar, cuando falten credenciales autenticadas o `E2E_EXCHANGE_ID`.
- La migracion `20260602103814_lock_internal_billing_and_rate_limit_tables.sql` cierra acceso directo de cliente a billing y rate limits; esas tablas son server-side.

## Checklist rapido

- [ ] No hay redirects circulares nuevos.
- [ ] No hay datos de otro departamento/empresa accesibles por URL manipulada.
- [ ] No hay secretos ni service role fuera de servidor.
- [ ] No hay cache privada para rutas protegidas.
- [ ] Las mutaciones devuelven `{ success: true }` cuando la UI depende de ello.
- [ ] Las migraciones con columnas nuevas revisan grants y policies.
- [ ] Tablas internas server-side sin grants para `anon`/`authenticated`.
- [ ] Los errores muestran feedback util sin filtrar internals.
- [ ] Los smokes relevantes pasan o sus skips estan justificados.
