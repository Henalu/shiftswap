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
│   │   │   ├── page.tsx            # Lista intercambios + acciones directas + botón Chat
│   │   │   ├── [id]/page.tsx       # Detalle + confirmar/cancelar + PDF + botón Chat
│   │   │   └── actions.ts          # confirmExchange / cancelExchange
│   │   ├── profile/
│   │   │   ├── page.tsx            # Perfil (Server Component)
│   │   │   ├── profile-form.tsx    # Formulario perfil + avatar upload
│   │   │   └── actions.ts          # updateProfile (INSERT o UPDATE)
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
│   │   ├── notification-bell.tsx   # Notificaciones in-app + Realtime
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
│   │   └── middleware.ts
│   ├── utils.ts
│   ├── constants.ts
│   └── notifications.ts            # createNotification() helper
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
│   └── 00010_enable_realtime_for_messages.sql    # Añade messages a supabase_realtime publication
└── seeds/
    └── 01_demo_data.sql            # 1 empresa + 3 departamentos (UUIDs fijos)
```

### Chat — patrones clave
- `startConversation` recibe `FormData` con `shift_id` + `other_user_id`. El usuario actual se obtiene internamente con `supabase.auth.getUser()`.
- **Optimistic update**: al enviar, añadir mensaje con `id: "temp_${Date.now()}"` al estado local inmediatamente. La función `mergeIncomingMessage` (extraída) reemplaza el optimista cuando llega confirmación de DB (matching por `sender_id + content + id.startsWith("temp_")`). Dedup con `prev.some(m => m.id === incoming.id)`. Mensajes se ordenan por `created_at`.
- **Realtime**: tabla `messages` añadida a `supabase_realtime` publication via migración 00010. Sin filtro server-side (tabla no tiene REPLICA IDENTITY FULL); filtro client-side `if (incoming.conversation_id !== conversationId) return`.
- **Polling fallback**: `useEffect` con `setInterval(3000)` que consulta mensajes nuevos (`gte created_at`) por si Realtime no está habilitado o falla. Usa `latestCreatedAtRef` para eficiencia. Dedup via `mergeIncomingMessage`.
- **`DropdownMenuTrigger` sin `asChild`**: shadcn/ui en esta versión no expone `asChild` en los tipos de `DropdownMenuTrigger`. Aplicar estilos directamente al trigger (ya renderiza `<button>`).
- **Botón "Ir al chat"** en `/exchanges/[id]` y `/exchanges` listing: visible para ambos usuarios en estado `pending_confirmation` o `confirmed`.
- `/chat/page.tsx` hace segunda query a `exchanges` tras cargar conversaciones para obtener `exchange.status` (no usar `shift.status`). Usa `Map<shift_id, ExchangeStatus>` para lookup O(1).

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
- Server Actions que mutan estado deben devolver `{ success: true }` (no `null`) para que Client Components reaccionen visualmente sin esperar re-render

### Estilos
- Tailwind CSS como sistema principal
- No usar CSS modules ni styled-components
- Componentes shadcn/ui como base UI
- Responsive design mobile-first

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
- `confirmed` → cancelExchange → shift `cancelled` + exchange `cancelled`
- Rechazar solicitud sin exchange → shift vuelve a `open`

### Estados de una Solicitud (`shift_requests.status`)
- `pending` — Esperando respuesta
- `accepted` — Aceptada
- `rejected` — Rechazada
- `withdrawn` — Retirada por el solicitante

### Estados de un Intercambio (`exchanges.status`)
- `pending_confirmation` — Esperando confirmación de ambas partes
- `confirmed` — Confirmado
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
- [x] Notificaciones en app (NotificationBell)
- [x] Cancelar turno propio

### Fase 3 — Chat ✅ COMPLETADA
- [x] Chat en tiempo real entre empleados (Supabase Realtime)

### Fase 4 — Confirmación ✅ COMPLETADA
- [x] Flujo de confirmación de intercambio (/exchanges + /exchanges/[id], con acciones directas en cards pendientes)
- [x] Generación de documento PDF (@react-pdf/renderer, Route Handler)
- [x] Página de perfil con avatar upload (Supabase Storage)

### Fase 5 — Testing con usuarios
- [ ] Prueba con grupo piloto

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
