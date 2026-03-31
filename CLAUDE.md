# CLAUDE.md — ShiftSwap

### División de trabajo: este chat vs Claude Code

**Este chat (Claude) es SIEMPRE para:**
- Arquitectura y decisiones de diseño
- Revisar código que me traes
- Generar artículos y contenido
- Conversación, planificación y estrategia
- Preparar el prompt exacto para Claude Code

**Claude Code es SIEMPRE quien ejecuta:**
- Cualquier cambio en archivos del proyecto
- Builds y verificación
- Debugging con acceso al filesystem

## Proyecto
**ShiftSwap** es una plataforma web interna de intercambio de turnos entre empleados.
Funciona como un marketplace (estilo Wallapop/Tinder) donde los empleados publican turnos que quieren intercambiar y otros pueden aceptarlos.

## Direccion de Producto y Diseno
- **No es una web de marketing:** se comporta como un producto interno operativo
- **Objetivo UX principal:** minimizar carga cognitiva y facilitar que los usuarios completen tareas rapido
- **La app debe sentirse:** limpia, eficiente, fiable, moderna y muy legible
- **Balance visual deseado:** 70% claridad funcional, 20% pulido moderno, 10% personalidad visual
- **Referencias mentales activas:** Stripe por sistema visual y limpieza, Deputy por sensacion de producto workforce interno
- **Regla clave:** priorizar navegacion obvia, estados claros, jerarquia fuerte y acciones evidentes por encima de cualquier decision decorativa
- **Fuente persistida de contexto visual:** `.impeccable.md`

## Stack Tecnológico
- **Frontend:** Next.js 16 (App Router) con TypeScript — `params` y `searchParams` son `Promise<...>`, hay que hacer `await`
- **UI:** Tailwind CSS + shadcn/ui
- **Backend/BaaS:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Chat:** Supabase Realtime (Fase 3)
- **PDF:** @react-pdf/renderer o jsPDF (Fase 4)
- **Despliegue:** Vercel (frontend) + Supabase Cloud (backend)
- **Testing:** Pendiente de configurar (planificado con Vitest + React Testing Library)
- **Linting:** ESLint + Prettier

## Estructura del Proyecto
```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Header + SidebarNav, protegido
│   │   ├── chat/
│   │   │   ├── page.tsx            # Lista de conversaciones + contexto turno + estado exchange
│   │   │   ├── [id]/page.tsx       # Conversación individual
│   │   │   ├── [id]/chat-view.tsx  # Client Component con Realtime + optimistic update + polling fallback
│   │   │   └── actions.ts          # startConversation (FormData: shift_id + other_user_id)
│   │   ├── exchanges/
│   │   │   ├── page.tsx            # Lista de expedientes + fases del workflow + boton Chat
│   │   │   ├── [id]/page.tsx       # Expediente formal + firmas + aprobacion + PDF corporativo
│   │   │   └── actions.ts          # confirm/cancel + sign + retirada + soporte documental
│   │   ├── profile/
│   │   │   ├── page.tsx            # Perfil (Server Component)
│   │   │   ├── profile-form.tsx    # Formulario perfil + avatar upload
│   │   │   └── actions.ts          # updateProfile (INSERT o UPDATE)
│   │   ├── admin/
│   │   │   ├── page.tsx            # Dashboard admin
│   │   │   ├── exchanges/          # Cola de aprobaciones de cambios
│   │   │   ├── users/              # Gestion de roles
│   │   │   └── validations/        # Validacion manual de cuentas
│   │   └── shifts/
│   │       ├── page.tsx            # Lista turnos open + filtros
│   │       ├── [id]/page.tsx       # Detalle + interesados
│   │       ├── my/
│   │       │   ├── page.tsx        # Mis turnos + aceptar/rechazar/cancelar
│   │       │   └── actions.ts      # acceptRequest / rejectRequest / cancelShift
│   │       └── new/
│   │           ├── page.tsx
│   │           ├── shift-form.tsx
│   │           └── actions.ts      # createShift → redirige a /shifts/my
│   ├── api/
│   │   └── exchanges/[id]/pdf/
│   │       └── route.tsx           # Route Handler: genera PDF con @react-pdf/renderer
│   └── layout.tsx                  # Root layout — incluye <Toaster> de sonner
├── components/
│   ├── layout/
│   │   ├── header.tsx              # Logo + mobile nav + avatar dropdown
│   │   ├── notification-bell.tsx   # Centro de notificaciones + badge + navegación
│   │   └── sidebar-nav.tsx         # Client Component con active state
│   ├── shifts/
│   │   ├── shift-card.tsx
│   │   ├── shift-filters.tsx       # Filtros por URL searchParams
│   │   ├── interest-button.tsx
│   │   ├── cancel-shift-button.tsx # Confirmación UI para cancelar turno propio
│   │   └── actions.ts              # showInterest
│   └── ui/                         # shadcn/ui: button, card, badge, input,
│                                   # label, avatar, dialog, dropdown-menu,
│                                   # separator, sonner, tabs, textarea, alert-dialog
├── lib/
│   ├── supabase/
│   │   ├── server.ts               # createClient() para Server Components
│   │   ├── client.ts               # createClient() para Client Components
│   │   ├── admin.ts                # createAdminClient() con service role para notifications
│   │   └── middleware.ts
│   ├── utils.ts
│   ├── constants.ts
│   ├── notification-utils.ts       # resolve action_url / fallback de navegación
│   └── notifications.ts            # create/read/resolve helpers (service role)
└── types/index.ts
supabase/
├── migrations/
│   ├── 00001_initial_schema.sql
│   ├── 00002_user_profiles_insert.sql
│   ├── 00003_chat_rls_and_notification_types.sql
│   ├── 00004_fix_rls_companies_departments.sql
│   ├── 00005_exchanges_rls.sql
│   ├── 00006_storage_avatars.sql
│   ├── 00007_user_profiles_self_select.sql
│   ├── 00008_fix_user_profiles_recursive_rls.sql  # Fix 42P17 con SECURITY DEFINER
│   ├── 00009_shift_requests_update_policies.sql   # UPDATE policies para accept/reject/withdraw
│   ├── 00010_enable_realtime_for_messages.sql    # Añade messages a supabase_realtime publication
│   ├── 00011_exchange_signatures_and_documents.sql # Base de firmas/documentos
│   ├── 00012_signed_exchange_cancellation_requests.sql # Base historica de retirada reciproca
│   ├── 00013_notifications_center.sql            # Notifications realtime + trigger new_message
│   ├── 00014_notification_center_state_and_dedupe.sql # Dedupe + lifecycle de notifications
│   ├── 00015_employee_validation.sql             # Validacion manual de empleados
│   ├── 00016_roles_and_permissions.sql           # Roles, alcance admin y helpers
│   ├── 00017_allow_word_exchange_documents.sql   # Soporte Word/PDF en exchange-documents
│   ├── 00018_native_exchange_approval_workflow.sql # Workflow nativo, aprobacion y exchange_events
│   ├── 00019_exchange_compensation_terms_and_ledger.sql # Compensacion y shift_debt_transactions
│   ├── 00020_department_hierarchy.sql          # Jerarquia empresa -> area/taller -> departamento
│   ├── 00021_department_scope_and_change_requests.sql # Alcance real por departamento y cambios
│   ├── 00022_normalize_shift_schedule.sql      # Horarios oficiales por shift_type
│   ├── 00023_job_positions_and_profile_scope.sql # Puestos de trabajo por departamento operativo
│   ├── 00024_job_position_change_requests.sql  # Solicitudes de cambio de puesto
│   └── 00025_pilot_readiness_and_billing_foundation.sql # Rate limiting + billing foundation
└── seeds/
    └── 01_demo_data.sql            # 1 empresa + 3 departamentos (UUIDs fijos)
```

### Chat — patrones clave
- `startConversation` recibe `FormData` con `shift_id` + `other_user_id`. El usuario actual se obtiene internamente con `supabase.auth.getUser()`.
- **Optimistic update**: al enviar, añadir mensaje con `id: "temp_${Date.now()}"` al estado local inmediatamente. La función `mergeIncomingMessage` (extraída) reemplaza el optimista cuando llega confirmación de DB (matching por `sender_id + content + id.startsWith("temp_")`). Dedup con `prev.some(m => m.id === incoming.id)`. Mensajes se ordenan por `created_at`.
- **Realtime**: tabla `messages` añadida a `supabase_realtime` publication via migración 00010. Sin filtro server-side (tabla no tiene REPLICA IDENTITY FULL); filtro client-side `if (incoming.conversation_id !== conversationId) return`.
- **Polling fallback**: `useEffect` con `setInterval(3000)` que consulta mensajes nuevos (`gte created_at`) por si Realtime no está habilitado o falla. Usa `latestCreatedAtRef` para eficiencia. Dedup via `mergeIncomingMessage`.
- **Leído de chat**: al abrir `/chat/[id]` se marcan como leídos tanto los `messages` entrantes como las `notifications` de tipo `new_message` asociadas a esa conversación. Si el chat está abierto y entra un mensaje nuevo, `ChatView` repite ese marcado para no dejar badges fantasma.
- **Scroll móvil**: el auto-scroll solo debe ocurrir en la carga inicial o cuando entra un mensaje nuevo y el usuario sigue cerca del final; si el usuario sube manualmente, no volver a forzar el fondo.
- **`DropdownMenuTrigger` wrapper tipado**: `components/ui/dropdown-menu.tsx` usa `React.forwardRef` + `ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>` para preservar props de Radix (incluido `asChild`) y evitar errores de TypeScript en build de producción.
- **Botón "Ir al chat"** en `/exchanges/[id]` y `/exchanges` listing: visible para ambos usuarios en estado `pending_confirmation`, `confirmed`, `pending_department_approval` o `approved`.
- `/chat/page.tsx` hace segunda query a `exchanges` tras cargar conversaciones para obtener `exchange.status` (no usar `shift.status`). Usa `Map<shift_id, ExchangeStatus>` para lookup O(1).

### Exchanges — patrones clave
- **Unificación de detalle**: cuando ya existe exchange activo para un turno, `/shifts/[id]` redirige a `/exchanges/[id]` y `/shifts/my` trata ese caso como intercambio, no como turno en negociación.
- **Workflow nativo**: `confirmed` significa acuerdo alcanzado y pendiente de firmas; tras registrar ambas firmas, el expediente pasa a `pending_department_approval`; despues puede resolverse en `approved` o `rejected`.
- **Firmas en app**: las firmas viven dentro del expediente. Se guardan `signed_by_user_a_at`, `signed_by_user_b_at`, `signed_by_user_a_name` y `signed_by_user_b_name`.
- **Compensación del solicitante**: antes de firmar, `user_b` debe elegir entre `hours_bank` o `shift_exchange`. Si elige `shift_exchange`, debe indicar fecha futura y tipo de turno.
- **Bolsa de horas**: cuando el acuerdo es `hours_bank`, el sistema crea un asiento en `shift_debt_transactions` para registrar la deuda de 1 turno.
- **Aprobación departamental**: existe cola de revisión en `/admin/exchanges` para `department_admin`, `hr_admin` y `super_admin`.
- **Retirada antes de resolución**: en `pending_department_approval` puede solicitarse retirada; la otra parte la confirma o la rechaza. Si se confirma, el turno vuelve a `open`.
- **Documento de apoyo**: además del PDF generado por Route Handler, existe `document_url` para soporte opcional PDF/Word. No es el centro de la lógica del negocio.

### Notifications — patrones clave
- **Source of truth**: la campanita usa la tabla `notifications`; el layout carga las activas recientes y el unread count real con query separada.
- **createNotification** usa `createAdminClient()` con `SUPABASE_SERVICE_ROLE_KEY`; no depende de políticas `INSERT` del usuario autenticado para notificar a terceros.
- **Lifecycle**: `read` quita una notificación del badge; `resolved_at` la saca del inbox activo cuando el evento ya no requiere atención.
- **Dedupe**: usar `dedupe_key` por usuario/evento (`new_message:${conversationId}`, `exchange_cancelled:${exchangeId}`, etc.) para consolidar avisos repetidos.
- **Navegación**: cada notificación relevante debe incluir `data.action_url`. `notification-utils.ts` resuelve esa URL y deja fallbacks por `conversation_id`, `exchange_id` o `shift_id`.
- **Realtime**: `00013` publica `notifications` en `supabase_realtime` y `00014` añade el estado necesario para mantener badge e inbox sincronizados.
- **Chat -> notifications**: los mensajes crean notificación global de tipo `new_message` desde trigger SQL en la base de datos, no desde cliente, y se consolidan por conversación.
- **Marcado contextual**: abrir `/chat/[id]`, `/shifts/[id]` o `/exchanges/[id]` debe marcar o resolver las notificaciones relacionadas, no depender solo del dropdown.
- **UX de la campanita**: no marcar todo como leído al abrir. Marcar individual al pulsar, ofrecer `Marcar todas` y permitir descartar avisos resueltos.

### Build / PDF — patrones clave
- En Route Handlers que devuelven PDF, convertir el resultado de `renderToBuffer(...)` a `Uint8Array` antes de crear `new Response(...)` para satisfacer el tipado Web API de Next.js en producción.

### Organizacion / Perfil / PDF oficial - patrones clave
- **Jerarquia organizativa activa:** empresa -> departamento/taller padre -> departamento operativo -> puesto de trabajo.
- **Departamento operativo:** `user_profiles.department_id` siempre representa el departamento operativo final del empleado.
- **Puestos de trabajo:** `job_positions` cuelga del departamento operativo y `user_profiles.job_position_id` queda como relacion opcional del perfil.
- **Cambios de puesto:** el perfil muestra el puesto actual y el usuario solo puede solicitar cambios dentro de su propio departamento operativo; la aprobacion se resuelve desde `/admin/job-position-changes`.
- **PDF oficial obligatorio:** la ruta activa es `/api/exchanges/[id]/official-pdf`; `DPTO. O TALLER` usa el padre del departamento operativo, `Categoria` usa el departamento operativo real y `Puesto de trabajo` usa el puesto asignado del perfil cuando exista.
- **Firmas PDF:** mantener estilos compatibles con las fuentes base de `@react-pdf/renderer`; para Helvetica usar combinaciones soportadas como `fontStyle: "italic"` y evitar variantes no resueltas en produccion.

### Turnos - horarios normalizados
- **Fuente de verdad del horario:** `shift_type` determina automaticamente `start_time` y `end_time`.
- **Horarios fijos activos:** morning `06:00-14:00`, afternoon `14:00-22:00`, night `22:00-06:00`.
- **Creacion de turnos:** el formulario muestra horas readonly derivadas del tipo y el backend valida que no se inserten mezclas inconsistentes.

### Pilot readiness / billing / seguridad - patrones clave
- **Reset de contrasena activo:** las rutas vigentes son `/forgot-password` y `/reset-password`.
- **Auth endurecida:** login y registro pasan por rate limiting server-side persistido en SQL; no volver a depender solo del cliente para frenar abuso.
- **CAPTCHA configurable:** el registro puede exigir Cloudflare Turnstile cuando existen `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`.
- **Billing abstracto:** el modelo base soporta `owner_type = "user" | "company"`; no crear modelos paralelos separados para suscripciones por usuario y por empresa.
- **Fuente de verdad del acceso comercial:** `src/lib/billing.ts` resuelve el estado efectivo (`inactive`, `trialing`, `active`, `past_due`, `blocked`) y debe seguir siendo el punto central.
- **Feature flags de billing:** usar `BILLING_ENABLED`, `BILLING_MODE` y `BILLING_ENFORCEMENT` para activar o endurecer cobro sin rehacer el flujo.
- **Gate de acceso:** middleware y dashboard layout ya consultan billing; con enforcement duro, usuarios bloqueados deben caer en `/billing`.
- **Stripe v1:** existen `/api/billing/checkout`, `/api/billing/portal` y `/api/billing/webhooks/stripe`; la primera monetizacion prevista sigue siendo por usuario.
- **Rutas publicas operativas:** `/api/health` y el webhook de Stripe deben seguir accesibles fuera del gate del dashboard.
- **Emails transaccionales base:** Resend se usa de forma optativa para aprobacion y rechazo de cuenta; faltan aun los correos del ciclo comercial completo.

## Convenciones de Código

### Nombrado
- **Archivos:** kebab-case (`shift-card.tsx`, `use-shifts.ts`)
- **Componentes:** PascalCase (`ShiftCard`, `ChatBubble`)
- **Funciones/variables:** camelCase (`getShifts`, `isLoading`)
- **Tipos/Interfaces:** PascalCase con prefijo descriptivo (`ShiftStatus`, `UserProfile`)
- **Constantes:** UPPER_SNAKE_CASE (`MAX_SHIFTS_PER_DAY`)
- **Tablas DB:** snake_case plural (`shifts`, `shift_requests`)
- **Columnas DB:** snake_case (`user_id`, `created_at`)

### Componentes React
- Usar functional components con TypeScript
- Props tipadas con `interface` (no `type` para props)
- Exportar componentes como `export default` para páginas, `export` named para componentes
- Usar Server Components por defecto, `"use client"` solo cuando sea necesario
- Colocar lógica de fetching en Server Components o Server Actions

### Supabase
- Server Components / Server Actions: `import { createClient } from "@/lib/supabase/server"` → `const supabase = await createClient()`
- Client Components: `import { createClient } from "@/lib/supabase/client"` → `const supabase = createClient()`
- Row Level Security (RLS) activado en todas las tablas
- Políticas RLS para cada operación CRUD
- **Nunca usar `SELECT FROM misma_tabla` dentro de una política RLS** — causa `42P17: infinite recursion`. Usar funciones `SECURITY DEFINER` que bypassean RLS internamente.
- Turnos nocturnos (fin < inicio) son válidos — no validar que `end_time > start_time`
- Si trabajas en notificaciones, asumir que la base activa debe tener aplicadas `00013_notifications_center.sql` y `00014_notification_center_state_and_dedupe.sql`
- Server Actions que mutan estado deben devolver `{ success: true }` (no `null`) para que Client Components reaccionen visualmente sin esperar re-render

### Estilos
- Tailwind CSS como sistema principal
- No usar CSS modules ni styled-components
- Componentes shadcn/ui como base UI
- Responsive design mobile-first
- El look & feel debe parecer un producto interno moderno, no una landing ni una web editorial
- Priorizar escaneabilidad, legibilidad, ritmo visual y claridad de estados
- Usar color sobre todo con significado semantico: exito, warning, pendiente, cancelacion, activo
- Reutilizar patrones visuales ya introducidos en el refresh UX/UI:
  - `PageHeader` para cabeceras de pagina
  - `EmptyState` para estados vacios
  - `FORM_CONTROL_CLASSNAME` para selects y controles sin wrapper propio
  - `PANEL_CLASSNAME` para superficies auxiliares
  - badges de estado desde `src/lib/constants.ts`

### Git
- Commits en inglés, formato convencional: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Rama principal: `main`
- Ramas de feature: `feature/nombre-descriptivo`
- Ramas de fix: `fix/descripcion-del-bug`

## Modelo de Datos Principal

### Tablas
- `user_profiles` — Perfil de empleado (extiende Supabase auth.users)
- `companies` — Empresas registradas
- `departments` — Departamentos dentro de una empresa
- `shifts` — Turnos publicados para intercambio
- `shift_requests` — Solicitudes de interés en un turno
- `conversations` — Conversaciones entre empleados
- `messages` — Mensajes dentro de conversaciones
- `exchanges` — Intercambios confirmados
- `exchange_events` — Historial y trazabilidad del expediente
- `shift_debt_transactions` — Ledger de deudas por bolsa de horas
- `notifications` — Inbox del usuario con badge, dedupe y estado leído/resuelto

### Estados de un Turno (`shifts.status`)
- `open` — Publicado, buscando intercambio
- `pending` — Solicitud aceptada, en negociación
- `confirmed` — Intercambio aceptado por ambas partes
- `completed` — Intercambio realizado
- `cancelled` — Cancelado

### Lógica de transición de estados
- `open` → acceptRequest → `pending` + crea exchange `pending_confirmation`
- `pending_confirmation` → confirmExchange (solo user_b) → exchange `confirmed` + shift `confirmed`
- `pending_confirmation` → cancelExchange → shift vuelve a `open` + request vuelve a `pending`
- `confirmed` → signExchange (ambas partes) → exchange `pending_department_approval`
- `confirmed` → cancelExchange → shift vuelve a `open` + exchange `cancelled`
- `pending_department_approval` → approveExchangeRequest → exchange `approved`
- `pending_department_approval` → rejectExchangeRequest → exchange `rejected` + shift vuelve a `open`
- `pending_department_approval` → requestSignedExchangeCancellation → exchange sigue `pending_department_approval` + retirada pendiente
- `pending_department_approval` → confirmSignedExchangeCancellation → exchange `cancelled` + shift vuelve a `open`
- `pending_department_approval` → rejectSignedExchangeCancellation → exchange sigue `pending_department_approval`
- Rechazar solicitud sin exchange → shift vuelve a `open`

### Estados de una Solicitud (`shift_requests.status`)
- `pending` — Esperando respuesta
- `accepted` — Aceptada
- `rejected` — Rechazada
- `withdrawn` — Retirada por el solicitante

### Estados de un Intercambio (`exchanges.status`)
- `pending_confirmation` — Esperando confirmación de ambas partes
- `confirmed` — Acuerdo alcanzado, pendiente de firmas
- `pending_department_approval` — Firmado por ambas partes y pendiente de decisión departamental
- `approved` — Aprobado por el responsable del departamento
- `rejected` — Rechazado por el responsable del departamento
- `completed` — Completado (documento generado)
- `cancelled` — Cancelado

## Fases de Desarrollo

### Fase 1 — Prototipo ✅ COMPLETADA
- [x] Setup proyecto Next.js + Supabase
- [x] Autenticación (login/registro)
- [x] CRUD de turnos (publicar, listar, detalle)
- [x] Lista de turnos disponibles (/shifts)
- [x] Botón "Me interesa" (shift_requests)
- [x] Página "Mis turnos" (/shifts/my) con gestión de solicitudes (aceptar/rechazar)
- [x] Navegación responsiva (sidebar desktop con active state + mobile nav en header)

### Fase 2 — Matching ✅ COMPLETADA
- [x] Filtros en listing: por departamento, tipo de turno, rango de fechas (URL searchParams)
- [x] Contador de resultados con filtros aplicados
- [x] Notificaciones en app (NotificationBell, badge global y navegación)
- [x] Cancelar turno propio

### Fase 3 — Chat ✅ COMPLETADA
- [x] Chat en tiempo real entre empleados (Supabase Realtime)

### Fase 4 — Confirmación ✅ COMPLETADA
- [x] Flujo de confirmación de intercambio (/exchanges + /exchanges/[id], con acciones directas en cards pendientes)
- [x] Firma final dentro de la app, solicitud formal y retirada recíproca antes de la resolución
- [x] Aprobación/rechazo por departamento y trazabilidad del expediente
- [x] Generación de documento PDF corporativo (@react-pdf/renderer, Route Handler)
- [x] Página de perfil con avatar upload (Supabase Storage)

### Fase 5 — Testing con usuarios
- [ ] Prueba con grupo piloto
- [x] Primera pasada de refresh UX/UI aplicada en navegacion, jerarquia visual, forms, cards, empty states y sistema de estados
- [x] Acuerdos de compensación (`hours_bank` / `shift_exchange`) y base de ledger `shift_debt_transactions`
- [x] Base de pilot readiness y billing foundation implementada (reset de contrasena, rate limiting, CAPTCHA configurable, `/billing`, Stripe base y `health` endpoint)
- [ ] Ajustes finales basados en observacion de usuarios reales

## Agentes Disponibles — Cuándo Activar Cada Uno

Los agentes están instalados en `~/.claude/agents/`. Actívalos con: *"Use [nombre] to..."* o *"Activate [nombre] mode"*.

### Por casuística de desarrollo

| Casuística | Agente | Ejemplo |
|---|---|---|
| Nuevo componente UI, página Next.js, Tailwind | `engineering-frontend-developer` | "Use Frontend Developer to build the shift card component" |
| Server Actions, queries Supabase, lógica de negocio | `engineering-backend-architect` | "Use Backend Architect to design the cancellation flow" |
| Decisión de arquitectura, nueva feature compleja | `engineering-software-architect` | "Use Software Architect to design the notification system" |
| Review antes de commit o PR | `engineering-code-reviewer` | "Use Code Reviewer to review my changes in exchanges/actions.ts" |
| Implementación compleja que requiere criterio senior | `engineering-senior-developer` | "Use Senior Developer to implement the realtime polling fallback" |
| Políticas RLS, auth flows, vulnerabilidades | `engineering-security-engineer` | "Use Security Engineer to audit the RLS policies in user_profiles" |
| Schema, índices, queries lentas, Supabase performance | `engineering-database-optimizer` | "Use Database Optimizer to improve this Supabase query" |
| Vercel config, CI/CD, variables de entorno, deploy | `engineering-devops-automator` | "Use DevOps Automator to set up preview deployments" |
| Prueba de concepto rápida antes de comprometerse | `engineering-rapid-prototyper` | "Use Rapid Prototyper to sketch the PDF signing flow" |
| Documentación, README, comentarios de código | `engineering-technical-writer` | "Use Technical Writer to document the exchange state machine" |
| Branching, commits, resolución de conflictos | `engineering-git-workflow-master` | "Use Git Workflow Master to clean up this branch" |
| Diseño visual, sistema de componentes, estilos | `design-ui-designer` | "Use UI Designer to improve the shift card visual hierarchy" |
| Flujos UX, estructura de navegación, layout | `design-ux-architect` — | "Use UX Architect to redesign the exchange confirmation flow" |
| Tests de API Routes y Server Actions | `testing-api-tester` | "Use API Tester to write tests for the PDF route handler" |
| Auditoría WCAG, accesibilidad de formularios | `testing-accessibility-auditor` | "Use Accessibility Auditor to review the chat interface" |
| Métricas de rendimiento, bundle size, Core Web Vitals | `testing-performance-benchmarker` | "Use Performance Benchmarker to profile the shifts listing page" |
| Priorización de features, roadmap, decisiones de producto | `product-manager` | "Use Product Manager to prioritize Phase 5 features" |

### Regla general
- **Cambios en UI/componentes** → `engineering-frontend-developer`
- **Cambios en lógica de datos/acciones** → `engineering-backend-architect`
- **Antes de cualquier merge importante** → `engineering-code-reviewer`
- **Nueva feature que requiere diseñar antes de implementar** → `engineering-software-architect`
- **Algo relacionado con Supabase RLS o auth** → `engineering-security-engineer`

## Comandos Impeccable — Cuándo Ejecutar (automático)

Los siguientes comandos se ejecutan **sin que tengas que pedirlos**. Son parte del flujo de trabajo estándar de ShiftSwap.

| Momento | Comando | Por qué |
|---------|---------|---------|
| Después de implementar cualquier componente, página o feature de UI | `/polish` | Cierra el gap entre "funciona" y "está listo para merge" — alineación, espaciado, coherencia visual con shadcn/ui |
| Antes de hacer merge de cualquier cambio visible al usuario | `/audit` | Revisa accesibilidad (a11y), responsive mobile-first y coherencia de interfaz |
| Al tocar formularios, inputs, botones de acción o mensajes de validación | `/clarify` | Mejora copy: labels, errores inline, confirmaciones — crítico en flujos de intercambio y firma |
| Al modificar layouts de página (dashboard, exchanges, chat) | `/arrange` | Corrige espaciado, jerarquía visual y ritmo — especialmente en vistas con múltiples cards |
| Al crear componentes que deben seguir el design system de shadcn/ui | `/normalize` | Asegura tokens, variantes y estilos coherentes con el sistema ya establecido |
| Cuando un componente maneja estados vacíos, errores o edge cases | `/harden` | Añade empty states robustos, overflow de texto y manejo de estados inesperados |
| Al implementar o modificar navegación, onboarding de registro o validación | `/onboard` | Mejora la experiencia de primeros pasos y empty states de usuario nuevo |
| Después de implementar cualquier vista con tabla, lista o grid de datos | `/adapt` | Verifica experiencia móvil — ShiftSwap es mobile-first y los empleados usan el móvil |

### Comandos bajo demanda (no automáticos)

| Cuándo pedirlos | Comando |
|-----------------|---------|
| "Añade micro-interacciones al chat o a las cards de turno" | `/animate` |
| "La interfaz se ve apagada o monótona" | `/colorize` |
| "Revisa la UX del flujo de confirmación / cancelación" | `/critique` |
| "Identifica componentes repetidos para extraer al design system" | `/extract` |
| "Optimiza el rendimiento de la lista de turnos o el bundle" | `/optimize` |
| "Configura el contexto de diseño del proyecto para impeccable" | `/teach-impeccable` |

---

## Comandos Útiles
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run lint         # Linting
npx supabase start   # Supabase local
npx supabase db push # Aplicar migraciones
```

## Seed de datos de prueba
El fichero `supabase/seeds/01_demo_data.sql` crea 1 empresa y 3 departamentos con UUIDs fijos.
Pégalo en el SQL Editor de Supabase para poder registrar usuarios.

## Variables de Entorno Requeridas
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Variables de Entorno Operativas / Billing
```
NEXT_PUBLIC_APP_URL=
BILLING_ENABLED=false
BILLING_MODE=user
BILLING_ENFORCEMENT=off
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_USER_MONTHLY_PRICE_ID=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

## Employee Validation â€” patrones clave
- **Acceso al dashboard:** solo usuarios con `validation_status = 'approved'` llegan a rutas del dashboard; `pending` y `rejected` van a `/pending-validation` por middleware.
- **Perfil consolidado:** `/profile` no muestra nunca el proceso de validaciÃ³n ni campos internos (`validation_status`, `id_card_url`, `validated_by`, `validated_at`, `validation_notes`).
- **Datos laborales readonly:** empresa, `employee_id` y departamento se muestran como resultado consolidado y no se editan desde el perfil.
- **Mutaciones del perfil:** `updateProfile` solo modifica `full_name`, `phone`, `email` y `avatar_url`.
- **Campos sensibles de `user_profiles`:** si una pÃ¡gina necesita `employee_id` u otros campos protegidos, resolverlo server-side; no reabrir permisos amplios en cliente.
## Roles & Permissions â€” patrones clave
- **Fuente de verdad:** el cÃ³digo nuevo debe leer `user_profiles.role`; `is_admin` queda solo como compatibilidad temporal y no se usa en la lÃ³gica nueva.
- **Roles soportados:** `member`, `department_admin`, `hr_admin`, `super_admin`.
- **Alcance admin:** `department_admin` ve y valida solo su empresa + departamento; `hr_admin`, toda su empresa; `super_admin`, todo el sistema y puede cambiar roles.
- **Panel admin:** las rutas `/admin/*` viven dentro del grupo `(dashboard)` para reutilizar `Header` + `SidebarNav`.
- **Middleware:** primero bloquea por `validation_status`; despuÃ©s, si la ruta empieza por `/admin`, redirige a `/shifts` cuando `role = 'member'`.
- **RLS en `user_profiles`:** usar helpers `SECURITY DEFINER` (`get_user_role`, `get_user_company`, `get_user_department`) para evitar `42P17` dentro de polÃ­ticas de la misma tabla.
- **Visibilidad de perfiles aprobados:** se mantiene la lectura de perfiles `approved` dentro de la misma empresa para no romper joins existentes de turnos, chat e intercambios; las filas `pending/rejected` quedan limitadas por alcance admin.
- **Bootstrap de super admin:** un `super_admin` puede tener `company_id = NULL` y `department_id = NULL`; para bootstrap inicial, crear primero el usuario en `auth.users` y luego promocionar su `user_profile`.
