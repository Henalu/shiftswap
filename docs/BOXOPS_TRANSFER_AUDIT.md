# BoxOps -> ShiftSwap transfer audit

Fecha: 2026-06-01.

Objetivo: revisar que aprendizajes de BoxOps tienen sentido para ShiftSwap sin convertirlo en otro producto ni contaminar el flujo v2 de intercambio de turnos.

## Veredicto

Si merece traer de BoxOps:

- disciplina de contexto para LLM y humanos;
- gates de seguridad/readiness;
- tooling local menos fragil;
- smokes mas ergonomicos;
- documentacion de decisiones UI;
- cuidado con datos privados, cache y service role.

No merece copiar literalmente:

- multi-tenant SaaS Console;
- roles `owner/admin/manager/coach`;
- programacion documental, fichaje, payroll, geolocalizacion o IA;
- modelo de bloques de CrossFit;
- soporte auditado de plataforma.

ShiftSwap es mas cerrado y operativo: empleados, departamentos, turnos, propuestas, firma y aprobacion departamental. Las mejoras utiles son de proceso, seguridad y UX, no de dominio.

## Transferido ahora

- `npm run typecheck` como gate local.
- Config local de Supabase con puertos aislados para ShiftSwap.
- `npm run supabase:reset` protegido; `supabase:reset:danger` queda explicito.
- Playwright smoke lee `.env.local`.
- Playwright permite usar servidor ya abierto con `E2E_START_SERVER=0`.
- Smokes detectan overlays/errores de framework tras abrir rutas.
- Supabase env helper centraliza errores de variables faltantes.
- `createAdminClient()` falla con error claro si falta service role.
- Middleware anade `Cache-Control: no-store` y `Pragma: no-cache`.
- `allowedDevOrigins` permite trabajar con `127.0.0.1`.
- Nuevo `docs/SECURITY_BASELINE.md`.
- `next` y `eslint-config-next` subidos a `16.2.6`; los `high` de `npm audit --omit=dev --audit-level=high` quedan resueltos.

## UX/UI transferible

### Adoptar

- Mantener navegacion cotidiana simple: maximo 4-5 items en mobile.
- Evitar copy tecnico en UI: no hablar de RLS, payload, workflow interno, Supabase o estados historicos.
- Documentar decisiones de pantallas densas como contrato del producto.
- Revisar controles compactos con textos largos: departamentos, puestos, nombres, comentarios y estados.
- Auditar mobile 390x844 y desktop 1280x800 antes de piloto.
- Usar estados visuales con texto + color + icono, nunca solo color.

### Candidatos para siguiente corte

- Crear `docs/product/ui-decisions.md` para ShiftSwap, similar a BoxOps, con decisiones del flujo v2.
- Crear un modelo visual de estados para `open`, `negotiating`, `accepted`, `pending_validation`, `approved`, `rejected`, `cancelled`, `expired`.
- Revisar mobile bottom nav: hoy no incluye `Mis turnos`; puede ser correcto, pero el piloto debe validar si publicar/aceptar propuestas queda demasiado lejos.
- Revisar pantallas admin densas con `/arrange` + `/audit`: aprobaciones, validaciones, usuarios y calendario.

## Seguridad transferible

### Adoptar

- Treat security as release gate, no como limpieza final.
- Service role solo como herramienta servidor y con validacion previa de actor/rol/alcance.
- No cache en rutas protegidas.
- Dependencias revisadas antes de staging/piloto.
- SQL rollback o smokes negativos para permisos de alto riesgo.
- Evidencia redacted fuera del repo cuando haya datos reales.

### Candidatos para siguiente corte

- Smokes negativos de permisos:
  - miembro no entra en `/admin/*`;
  - `department_admin` no ve otros departamentos;
  - `hr_admin` no cruza empresa;
  - usuario rejected/pending no entra al dashboard;
  - PDF de expediente inaccesible para usuario sin relacion.
- Guardrail estatico para `SUPABASE_SERVICE_ROLE_KEY`: literal solo en `src/lib/supabase/admin.ts`.
- Checklist SQL de column grants para cada migration que toque `user_profiles`.

## Desarrollo local transferible

### Adoptar

- Supabase local reproducible con `supabase/config.toml`.
- Reset local bloqueado por defecto.
- `.env.local` como fuente de smokes, sin exportar variables a mano.
- `typecheck`, `lint`, `build`, `smoke` como gate comun.

### Candidatos para siguiente corte

- Script local E2E que cree usuarios de prueba en `auth.users` + `user_profiles` con rollback por defecto, adaptado a roles ShiftSwap.
- Scripts separados de smoke por rol: `member`, `admin`, `super_admin`.
- `npx supabase db lint --local` documentado cuando haya Supabase local levantado.

## Contexto para LLM

BoxOps mejoro al separar:

- brief fuente de verdad;
- tareas/roadmap vivo;
- guias para volver al repo;
- decisiones UI;
- security baseline;
- runbooks operativos.

ShiftSwap ya tiene `CLAUDE.md`, `MEMORY.md`, `LESSONS.md`, `README.md` y docs operativas. El siguiente salto no es mas volumen: es hacer que cada doc responda a una pregunta clara.

Propuesta:

- `CLAUDE.md`: contrato de arquitectura/producto.
- `MEMORY.md`: estado vivo y ultima evidencia.
- `LESSONS.md`: trampas tecnicas aprendidas.
- `docs/SECURITY_BASELINE.md`: gate de seguridad.
- `docs/BOXOPS_TRANSFER_AUDIT.md`: esta comparativa y backlog.
- Futuro `docs/product/ui-decisions.md`: decisiones UX del flujo v2.

## Prioridad recomendada

1. Ejecutar los nuevos gates locales: `typecheck`, `lint`, `build`, `test:smoke`.
2. Crear smokes negativos de permisos y acceso a PDFs.
3. Documentar estados visuales del flujo v2.
4. Validar con usuarios si mobile necesita acceso mas directo a `Mis turnos`.
5. Preparar script E2E local con rollback para crear usuarios miembro/admin/super admin.

## Deuda residual

- `npm audit --omit=dev` aun reporta vulnerabilidades moderadas por `postcss` anidado dentro de Next. El fix automatico propone un downgrade incompatible a Next 9.3.3, asi que no se aplica.
