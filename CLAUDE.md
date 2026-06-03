# CLAUDE.md - ShiftSwap

### Division de trabajo: este chat vs Codex

**Este brief es siempre para:**
- arquitectura y decisiones de producto
- revisar codigo y documentacion
- planificar roadmap y prioridades
- congelar la semantica real del proyecto

**Codex es quien ejecuta:**
- cambios en archivos
- builds, lint y smoke
- debugging con acceso al repo

## Proyecto

**ShiftSwap** es una plataforma web interna de intercambio de turnos entre empleados. Se comporta como un producto operativo de workforce management, no como una web de marketing.

## Direccion de Producto y Diseno

- Objetivo UX principal: minimizar carga cognitiva y permitir completar tareas rapido
- La app debe sentirse: limpia, eficiente, fiable, moderna y muy legible
- Balance visual deseado:
  - 70% claridad funcional
  - 20% pulido moderno
  - 10% personalidad visual
- Referencias mentales activas:
  - Stripe por limpieza y sistema visual
  - Deputy por sensacion de producto interno workforce
- Regla clave: priorizar navegacion obvia, estados claros, jerarquia fuerte y acciones evidentes
- Fuente persistida de contexto visual: `.impeccable.md`

## Stack Tecnologico

- Frontend: Next.js 16 App Router + TypeScript
- UI: Tailwind CSS + shadcn/ui
- Backend/BaaS: Supabase (Postgres, Auth, Realtime, Storage)
- Chat: Supabase Realtime
- PDF: `@react-pdf/renderer`
- Despliegue: Vercel + Supabase Cloud
- Smoke automation: Playwright
- Testing unitario: todavia pendiente

## Estructura del Proyecto

```text
src/
  app/
    (auth)/
      login/
      register/
      forgot-password/
      reset-password/
      pending-validation/
    (dashboard)/
      shifts/
      calendar/
      chat/
      exchanges/
      profile/
      help/
      admin/
        platform/
        exchanges/
        validations/
        department-changes/
        job-position-changes/
        schedule-config/
        users/
    api/
      exchanges/[id]/pdf/
      exchanges/[id]/official-pdf/
      billing/
      health/
  components/
    exchanges/
    layout/
    profile/
    shifts/
    ui/
  lib/
    billing.ts
    calendar.ts
    calendar-data.ts
    exchange-compensation.ts
    exchange-workflow.ts
    notifications.ts
    shifts.ts
    supabase/
  types/

supabase/
  migrations/
    00001 ... 00030
  seeds/
    01_demo_data.sql
    02_arcelor_organization.sql

tests/
  smoke/
```

### Chat - patrones clave

- `startConversation` recibe `FormData` con `shift_id` y `other_user_id`.
- `ChatView` usa Realtime con fallback por polling.
- Los mensajes nuevos generan notificaciones SQL de tipo `new_message`.
- Abrir `/chat/[id]` marca mensajes y notificaciones relacionadas como leidos.

### Exchanges - patrones clave

- El flujo vivo es **v2**, no el workflow antiguo de `pending_confirmation` y `confirmed`.
- El usuario interesado propone directamente un acuerdo desde el tablon:
  - `hours_bank`
  - `shift_exchange`
- La parte publicadora acepta o rechaza desde `Mis turnos`.
- Al aceptar:
  - la propuesta pasa a `accepted`
  - el turno pasa a `negotiating`
  - se crea `exchanges`
  - la firma del publicador queda implicita
- La unica firma explicita del flujo v2 es `signAsInterested`, realizada por `user_b`.
- Tras esa firma, el expediente pasa a `pending_validation`.
- La aprobacion o rechazo departamental vive en `/admin/exchanges`.
- En `pending_validation` puede solicitarse retirada reciproca antes de resolverse.
- El PDF es una salida del expediente, no el centro del negocio.

### Notifications - patrones clave

- La campanita usa `notifications` como source of truth.
- `createNotification` usa `createAdminClient()` con service role.
- `dedupe_key` consolida eventos repetidos.
- Cada aviso relevante debe incluir `data.action_url`.
- `resolved_at` saca el aviso del inbox activo; `read` solo lo quita del badge.

### Build / PDF - patrones clave

- En Route Handlers que devuelven PDF, convertir `renderToBuffer(...)` a `Uint8Array` antes de crear `Response`.
- Mantener estilos compatibles con Helvetica base de `@react-pdf/renderer`.

### Organizacion / Perfil / PDF oficial - patrones clave

- Jerarquia activa:
  - empresa
  - area o taller padre
  - departamento operativo
  - puesto de trabajo
- `user_profiles.department_id` siempre representa el departamento operativo final.
- `job_positions` cuelga del departamento operativo.
- El PDF oficial usa:
  - `DPTO. O TALLER` = padre del departamento operativo
  - `Categoria` = departamento operativo real
  - `Puesto de trabajo` = puesto asignado del perfil

### Turnos, calendario y horarios - patrones clave

- `shift_type` es la fuente de verdad del horario.
- Tipos activos:
  - `morning`
  - `afternoon`
  - `night`
  - `normal_full`
  - `normal_short`
- Horarios oficiales:
  - `morning` = `06:00-14:00`
  - `afternoon` = `14:00-22:00`
  - `night` = `22:00-06:00`
  - `normal_full` = `08:00-16:00`
  - `normal_short` = `08:00-14:00`
- El calendario laboral soporta:
  - `3t5`
  - `jornada_normal`
  - rotaciones por grupo
  - vacaciones
  - overrides puntuales
- `src/lib/calendar.ts` y `src/lib/calendar-data.ts` son la fuente de verdad para validaciones de dia laborable.
- `/calendar` muestra el horario mensual del usuario.
- `/calendar/vacations` permite registrar vacaciones.
- `/admin/schedule-config` configura tipo de jornada por area y grupo de rotacion por usuario.

### Pilot readiness / billing / seguridad - patrones clave

- Reset de contrasena activo: `/forgot-password` y `/reset-password`.
- Login y registro usan rate limiting server-side persistido en SQL.
- El registro puede exigir Cloudflare Turnstile si las variables existen.
- `src/lib/billing.ts` resuelve el estado comercial efectivo:
  - `inactive`
  - `trialing`
  - `active`
  - `past_due`
  - `blocked`
- Feature flags:
  - `BILLING_ENABLED`
  - `BILLING_MODE`
  - `BILLING_ENFORCEMENT`
- `BILLING_ENFORCEMENT=soft` muestra estado comercial sin bloquear operativa.
- `BILLING_ENFORCEMENT=hard` bloquea cuentas `blocked`; solo pueden acceder a `/billing`.
- Pricing B2C early adopter activo para monetizacion inicial por usuario final:
  - `founder_20`: primeras 20 cuentas, 30 dias de trial, 1,49 EUR/mes o 14,99 EUR/ano
  - `early_70`: cuentas 21-70, 1,99 EUR/mes o 19,99 EUR/ano
  - `growth_170`: cuentas 71-170, 2,39 EUR/mes o 23,99 EUR/ano
  - `launch_200`: cuentas 171-200, 2,69 EUR/mes o 26,99 EUR/ano
  - `standard`: desde 201, 2,99 EUR/mes o 29,99 EUR/ano
- Los planes publicos de `/billing` deben ser solo `owner_type = user`, `active = true` e `is_public = true`.
- B2B queda planificado pero no activo: planes `owner_type = company` ocultos hasta implementar comprador `hr_admin`, plazas e invitaciones.
- `/admin/platform` es el panel MVP de super admin para organizaciones, usuarios, planes, cohortes y metricas mensuales.
- Rutas publicas operativas:
  - `/api/health`
  - `/api/billing/webhooks/stripe`
- La primera monetizacion prevista sigue siendo B2C por usuario final. Cuando exista B2B, la precedencia sera `company > user`.

### Firma digital - patrones clave

- `user_profiles.signature_url` apunta al PNG en el bucket `signatures`.
- `requireSignature(userId)` se aplica en:
  - `createShift`
  - `proposeExchange`
  - `acceptProposal`
  - `signAsInterested`
  - `approveExchangeRequest`
  - `rejectExchangeRequest`
- `SignaturePad` guarda PNG en Storage.
- Los dos PDFs renderizan la firma cuando existe.

### Onboarding - patrones clave

- Trigger: `user_profiles.onboarding_completed_at IS NULL`
- Componente: `OnboardingModal`
- La accion `completeOnboarding()` persiste el timestamp
- El modal no bloquea el uso del producto

### Help - patrones clave

- Ruta: `/help`
- Miembros ven ayuda de uso diario
- Admins ven tambien aprobaciones, validaciones y gestion organizativa

## Convenciones de Codigo

### Nombrado

- Archivos: kebab-case
- Componentes: PascalCase
- Funciones y variables: camelCase
- Tipos e interfaces: PascalCase
- Tablas y columnas DB: snake_case

### Componentes React

- Server Components por defecto
- `"use client"` solo cuando haga falta
- Llamadas de datos en Server Components o Server Actions
- Props tipadas con `interface`

### Supabase

- Server Components / Server Actions:
  - `import { createClient } from "@/lib/supabase/server"`
- Client Components:
  - `import { createClient } from "@/lib/supabase/client"`
- RLS activado en todas las tablas
- Nunca hacer `SELECT FROM user_profiles` dentro de una policy de `user_profiles`
- Si una migration anade columnas a `user_profiles`, revisar tambien column-level grants
- Las Server Actions que mutan estado deben devolver `{ success: true }` cuando la UI dependa de esa reaccion

### Redirects entre paginas - reglas de seguridad

- `/profile` es la pagina segura del dashboard
- No crear ciclos de `redirect(...)`
- Diferenciar query fallida de dato ausente
- Si se anade una columna nueva a una query critica, dejar fallback o query separada
- Ver `LESSONS.md` para patrones defensivos ya aprendidos

### Estilos

- Tailwind como sistema principal
- No usar CSS modules ni styled-components
- Reutilizar patrones base:
  - `PageHeader`
  - `EmptyState`
  - `PANEL_CLASSNAME`
  - `FORM_CONTROL_CLASSNAME`
  - badges desde `src/lib/constants.ts`

### Git

- Commits en ingles con formato convencional:
  - `feat:`
  - `fix:`
  - `refactor:`
  - `docs:`
  - `chore:`

## Modelo de Datos Principal

### Tablas clave

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
- `notifications`
- `department_change_requests`
- `job_position_change_requests`
- `rotation_patterns`
- `rotation_groups`
- `area_schedule_configs`
- `user_rotation_assignments`
- `vacations`
- `schedule_overrides`

### Estados de un Turno (`shifts.status`)

- `open`
- `negotiating`
- `completed`
- `cancelled`
- `expired`

### Estados de una Solicitud (`shift_requests.status`)

- `pending`
- `accepted`
- `rejected`
- `withdrawn`

### Estados de un Intercambio (`exchanges.status`)

- `accepted`
- `pending_validation`
- `approved`
- `rejected`
- `completed`
- `cancelled`
- `expired`

### Logica de transicion vigente

- `open` -> `proposeExchange` -> crea `shift_requests.pending`
- `pending` -> `acceptProposal` -> `shift_requests.accepted` + `shifts.negotiating` + `exchanges.accepted`
- `pending` -> `rejectProposal` -> `shift_requests.rejected`
- `accepted` -> `signAsInterested` -> `exchanges.pending_validation`
- `pending_validation` -> `approveExchangeRequest` -> `exchanges.approved`
- `pending_validation` -> `rejectExchangeRequest` -> `exchanges.rejected` + turno reabierto
- `pending_validation` -> `requestSignedExchangeCancellation` -> retirada pendiente
- `pending_validation` -> `confirmSignedExchangeCancellation` -> `exchanges.cancelled` + turno reabierto
- turnos pasados sin cerrar pueden acabar en `expired`

## Fases de Desarrollo

### Fase 1 - Prototipo
- completada

### Fase 2 - Matching
- completada

### Fase 3 - Chat
- completada

### Fase 4 - Workflow formal
- completada

### Fase 4.5 - Refresh UX/UI
- completada

### Fase 4.6 - Organizacion, compensacion y perfil laboral
- completada

### Fase 4.7 - Billing foundation y seguridad operativa
- completada como base tecnica

### Fase 4.8 - Calendario laboral
- completada

### Fase 5 - Testing con usuarios
- en curso
- pendiente:
  - piloto real
  - staging validado
  - observabilidad minima
  - feedback de usuarios

## Agentes Disponibles — Cuándo Activar Cada Uno

### Por casuistica de desarrollo

| Casuistica | Skill sugerida | Uso |
|---|---|---|
| Nueva pagina o componente visible | `frontend-design` | construir UI nueva o rehacer una pantalla |
| Ajustar layout, spacing o jerarquia | `arrange` | ordenar pantallas con muchas cards o secciones |
| Cierre visual antes de merge | `polish` | pulido final |
| Revisión a11y, responsive y calidad UI | `audit` | chequeo previo a merge |
| Formularios, labels o errores poco claros | `clarify` | mejorar copy y entendibilidad |
| Estados vacios, errores y edge cases | `harden` | robustecer UX |
| Coherencia con design system | `normalize` | unificar tokens y variantes |
| Onboarding o primera experiencia | `onboard` | mejorar primeros pasos |
| Rendimiento | `optimize` | revisar listas, bundle o interacciones |

### Regla general

- Cambios visibles al usuario -> combinar `frontend-design` con `polish`
- Antes de merge de UI -> `audit`
- Formularios o textos operativos -> `clarify`
- Estados especiales o rutas sensibles -> `harden`

## Comandos Impeccable — Cuándo Ejecutar (automático)

| Momento | Skill |
|---|---|
| Despues de tocar una vista o componente UI | `/polish` |
| Antes de merge de cambios visibles | `/audit` |
| Al tocar formularios, botones o mensajes de validacion | `/clarify` |
| Al modificar layouts o pantallas densas | `/arrange` |
| Al crear o tocar patrones del design system | `/normalize` |
| Cuando una vista maneja empty states o edge cases | `/harden` |
| Al modificar navegacion u onboarding | `/onboard` |

### Comandos bajo demanda (no automaticos)

| Cuando pedirlos | Skill |
|---|---|
| Microinteracciones o motion | `/animate` |
| UI apagada o monotona | `/colorize` |
| Revisión UX de un flujo complejo | `/critique` |
| Extraer componentes repetidos | `/extract` |
| Optimizar rendimiento | `/optimize` |
| Actualizar contexto de diseño persistido | `/teach-impeccable` |

## Comandos Utiles

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run test:smoke
npm run supabase:start
npm run supabase:status
npm run supabase:reset
npx supabase db push
```

## Seed de datos de prueba

- `supabase/seeds/01_demo_data.sql`
- `supabase/seeds/02_arcelor_organization.sql`

## Variables de Entorno Requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
```

## Variables de Entorno Operativas / Billing / Smoke

```env
BILLING_ENABLED=false
BILLING_MODE=user
BILLING_ENFORCEMENT=off
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_FOUNDER_20_MONTHLY=
STRIPE_PRICE_FOUNDER_20_ANNUAL=
STRIPE_PRICE_EARLY_70_MONTHLY=
STRIPE_PRICE_EARLY_70_ANNUAL=
STRIPE_PRICE_GROWTH_170_MONTHLY=
STRIPE_PRICE_GROWTH_170_ANNUAL=
STRIPE_PRICE_LAUNCH_200_MONTHLY=
STRIPE_PRICE_LAUNCH_200_ANNUAL=
STRIPE_PRICE_STANDARD_MONTHLY=
STRIPE_PRICE_STANDARD_ANNUAL=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
E2E_BASE_URL=
E2E_PORT=
E2E_START_SERVER=
E2E_MEMBER_EMAIL=
E2E_MEMBER_PASSWORD=
E2E_ADMIN_EMAIL=
E2E_ADMIN_PASSWORD=
E2E_SUPER_ADMIN_EMAIL=
E2E_SUPER_ADMIN_PASSWORD=
E2E_EXCHANGE_ID=
```

## Employee Validation — patrones clave

- Solo usuarios `approved` acceden al dashboard
- `pending` y `rejected` van a `/pending-validation`
- El perfil no expone campos internos de validacion
- `updateProfile` solo modifica datos personales seguros

## Roles & Permissions — patrones clave

- Fuente de verdad: `user_profiles.role`
- Roles soportados:
  - `member`
  - `department_admin`
  - `hr_admin`
  - `super_admin`
- `department_admin` ve su alcance departamental
- `hr_admin` ve su empresa
- `super_admin` ve todo y gestiona roles
- `/admin/*` reutiliza el layout del dashboard
- `/admin/platform` queda reservado a `super_admin`
