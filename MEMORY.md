# MEMORY.md - ShiftSwap Project State

Archivo vivo con estado real del proyecto, decisiones importantes y siguientes pasos.

---

## Estado actual

- Fase: Fase 5 - testing con usuarios / preparacion real de piloto
- Ultima actualizacion: 2026-04-20
- Ultimo hito relevante: alineacion documental al flujo v2 + lint limpio + base automatizada de smoke con Playwright
- Estado general: funcionalmente estable y mas avanzada que el MVP; lista para staging y piloto si la base tiene aplicadas las migraciones hasta `00030`

## Resumen ejecutivo

- ShiftSwap ya cubre auth, validacion manual, turnos, propuestas v2, chat, firma, aprobacion departamental, PDFs, roles admin y billing foundation.
- El workflow activo ya no es el antiguo de `pending_confirmation` y `confirmed`; la semantica vigente es:
  - propuesta directa
  - aceptacion del publicador
  - firma explicita del solicitante
  - `pending_validation`
- El calendario laboral ya existe en codigo y base:
  - `3t5`
  - `jornada_normal`
  - grupos de rotacion
  - vacaciones
  - validacion de dia laborable
- `npm run build` y `npm run lint` pasan.
- Ya existe `npm run test:smoke` con Playwright para:
  - `GET /api/health`
  - login
  - rutas clave de miembro
  - colas admin
  - PDF routes opcionales si se configura `E2E_EXCHANGE_ID`

## Hitos consolidados

### 2026-03-26 - Pilot readiness y billing foundation

- Rate limiting persistido en auth
- Turnstile opcional
- reset de contrasena
- `/billing`
- checkout, portal y webhook Stripe
- `health` endpoint
- runbook y smoke manual inicial

### 2026-04-01 a 2026-04-02 - Hardening y fixes estructurales

- Correccion de redirects circulares
- fallbacks para queries criticas
- fix de column-level grants en `user_profiles`
- lecciones registradas en `LESSONS.md`

### 2026-04-20 - Estado real congelado

- Documentacion central alineada con el flujo v2
- `CLAUDE.md`, `README.md`, `docs/API.md` y `docs/ROADMAP.md` actualizados
- `docs/OPERATIONS.md` y `docs/SMOKE_CHECKLIST.md` reorientados a readiness real
- base automatizada de smoke anadida con Playwright

## Estado funcional real por bloques

### Auth y acceso

- login, registro, reset y pending validation operativos
- validacion manual obligatoria antes del dashboard
- role-based access operativa

### Turnos y propuestas

- tablon y filtros operativos
- flujo v2 de propuestas directo desde detalle
- `acceptProposal` y `rejectProposal` activos en `Mis turnos`
- `cancelShift` disponible
- turnos pasados pueden marcarse `expired`

### Expedientes

- `exchanges` ya es el expediente formal del cambio
- firma del publicador implicita al aceptar
- firma explicita del solicitante con `signAsInterested`
- aprobacion/rechazo departamental
- retirada reciproca previa a resolucion

### Organizacion y perfil laboral

- jerarquia empresa -> area -> departamento operativo -> puesto
- cambios de departamento y puesto con colas admin
- PDF oficial usando esa jerarquia

### Calendario laboral

- migracion `00030` activa el dominio de calendario
- `/calendar` y `/calendar/vacations` operativos
- `/admin/schedule-config` operativo
- `createShift` y `proposeExchange` validan el calendario del usuario cuando aplica

### Billing y readiness

- dominio de billing ya existe
- sigue pendiente la activacion comercial real
- el flujo individual esta preparado; la UX de empresa aun no esta construida

## Problemas conocidos

- El piloto real todavia no se ha ejecutado con usuarios finales.
- No existe una suite completa de tests unitarios o integration; solo una base de smoke/E2E.
- `npm run test:smoke` requiere entorno configurado y credenciales reales:
  - `E2E_MEMBER_*`
  - `E2E_ADMIN_*`
  - opcionalmente `E2E_SUPER_ADMIN_*`
  - opcionalmente `E2E_EXCHANGE_ID`
- Staging, uptime checks y alertas externas no pueden provisionarse solo desde el repo.
- El dominio de billing soporta `user` y `company`, pero faltan:
  - backoffice de onboarding de empresa
  - importacion CSV
  - precedencia `company > user`
- Los legales actuales siguen siendo base funcional y requieren revision real antes de cobro externo.

## Decisiones tecnicas importantes

- Server Components por defecto; `"use client"` solo cuando es necesario.
- `src/lib/billing.ts` es la fuente de verdad del acceso comercial.
- `src/lib/calendar.ts` y `src/lib/calendar-data.ts` son la fuente de verdad del calendario laboral.
- `createNotification` usa service role.
- Los dos PDFs son salidas del sistema, no el centro del flujo.
- `signatures`, `avatars`, `id-cards` y `exchange-documents` son buckets activos.
- Para staging y piloto, Supabase debe tener aplicadas las migraciones hasta `00030`.

## Archivos clave

- `CLAUDE.md` - brief maestro actualizado
- `README.md` - vision general real del repo
- `docs/API.md` - superficie tecnica vigente
- `docs/ROADMAP.md` - roadmap alineado al estado real
- `docs/OPERATIONS.md` - staging, observabilidad y rollback
- `docs/SMOKE_CHECKLIST.md` - checklist manual y smoke automatizado
- `src/app/(dashboard)/exchanges/actions.ts` - acciones del expediente v2
- `src/app/(dashboard)/shifts/my/actions.ts` - aceptar/rechazar propuestas
- `src/components/shifts/actions.ts` - proponer cambio y cancelar turno
- `src/lib/calendar.ts` - motor de calendario
- `src/lib/calendar-data.ts` - carga de configuracion de calendario
- `playwright.smoke.config.ts` - configuracion del smoke automatizado
- `tests/smoke/*` - suite Playwright

## Migraciones importantes

- `00025_pilot_readiness_and_billing_foundation.sql`
- `00026_shift_expired_status.sql`
- `00027_v2_exchange_flow.sql`
- `00028_phase3_signature_and_onboarding.sql`
- `00029_fix_column_grants.sql`
- `00030_calendar_rotation_and_vacations.sql`

## Siguientes pasos recomendados

1. Preparar staging separado y validar el smoke completo.
   - Recordatorio de timing: no es estrictamente necesario abrir `staging` hoy mientras sigamos afinando producto dentro del repo.
   - Momento recomendado para hacerlo: justo antes de arrancar el piloto real, o antes si vamos a tocar variables de entorno, deploy, observabilidad externa o credenciales E2E compartidas.
   - Senal de activacion: cuando el siguiente trabajo ya no sea "seguir construyendo" sino "probar el sistema como si fuera real".
2. Configurar observabilidad minima:
   - uptime check
   - alertas de build
   - revisiones de logs
3. Ejecutar piloto con usuarios reales y recoger friccion de:
   - bottom nav
   - propuestas y firma
   - calendario
   - colas admin
4. Endurecer pruebas alrededor de acciones criticas.
5. Decidir despues si el siguiente bloque es endurecimiento post-piloto o activacion comercial.
