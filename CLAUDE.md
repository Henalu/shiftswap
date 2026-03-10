# CLAUDE.md — ShiftSwap

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
- **Testing:** Vitest + React Testing Library
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
│   │   ├── chat/page.tsx           # Placeholder
│   │   ├── exchanges/page.tsx      # Placeholder
│   │   ├── profile/page.tsx        # Placeholder
│   │   └── shifts/
│   │       ├── page.tsx            # Lista turnos open + filtros
│   │       ├── [id]/page.tsx       # Detalle + interesados
│   │       ├── my/
│   │       │   ├── page.tsx        # Mis turnos + aceptar/rechazar
│   │       │   └── actions.ts      # acceptRequest / rejectRequest
│   │       └── new/
│   │           ├── page.tsx
│   │           ├── shift-form.tsx
│   │           └── actions.ts      # createShift
│   └── layout.tsx
├── components/
│   ├── layout/
│   │   ├── header.tsx              # Logo + mobile nav + avatar dropdown
│   │   └── sidebar-nav.tsx         # Client Component con active state
│   ├── shifts/
│   │   ├── shift-card.tsx
│   │   ├── shift-filters.tsx       # Filtros por URL searchParams
│   │   ├── interest-button.tsx
│   │   └── actions.ts              # showInterest
│   └── ui/                         # shadcn/ui: button, card, badge, input,
│                                   # label, avatar, dialog, dropdown-menu,
│                                   # separator, sonner, tabs, textarea
├── lib/
│   ├── supabase/
│   │   ├── server.ts               # createClient() para Server Components
│   │   ├── client.ts               # createClient() para Client Components
│   │   └── middleware.ts
│   ├── utils.ts
│   └── constants.ts
└── types/index.ts
supabase/
├── migrations/
│   ├── 00001_initial_schema.sql
│   └── 00002_user_profiles_insert.sql
└── seeds/
    └── 01_demo_data.sql            # 1 empresa + 3 departamentos (UUIDs fijos)
```

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
- `open` → aceptar una solicitud → `pending` (+ `shift_requests.status = 'accepted'`)
- `pending` → rechazar la única solicitud aceptada → `open`

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

### Fase 2 — Matching (en curso)
- [x] Filtros en listing: por departamento, tipo de turno, rango de fechas (URL searchParams)
- [x] Contador de resultados con filtros aplicados
- [ ] Notificaciones en app
- [ ] Cancelar turno propio

### Fase 3 — Chat
- [ ] Chat en tiempo real entre empleados (Supabase Realtime)

### Fase 4 — Confirmación
- [ ] Flujo de confirmación de intercambio
- [ ] Generación de documento PDF

### Fase 5 — Testing con usuarios
- [ ] Prueba con grupo piloto

## Comandos Útiles
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run lint         # Linting
npm run test         # Tests
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
