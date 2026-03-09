# CLAUDE.md — ShiftSwap

## Proyecto
**ShiftSwap** es una plataforma web interna de intercambio de turnos entre empleados.
Funciona como un marketplace (estilo Wallapop/Tinder) donde los empleados publican turnos que quieren intercambiar y otros pueden aceptarlos.

## Stack Tecnológico
- **Frontend:** Next.js 14+ (App Router) con TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Backend/BaaS:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Chat:** Supabase Realtime
- **PDF:** @react-pdf/renderer o jsPDF
- **Despliegue:** Vercel (frontend) + Supabase Cloud (backend)
- **Testing:** Vitest + React Testing Library
- **Linting:** ESLint + Prettier

## Estructura del Proyecto
```
src/
├── app/              # Next.js App Router (páginas y layouts)
│   ├── (auth)/       # Rutas de autenticación (login, register)
│   ├── (dashboard)/  # Rutas protegidas (turnos, chat, perfil)
│   ├── api/          # Route handlers de Next.js
│   └── layout.tsx    # Layout raíz
├── components/       # Componentes React reutilizables
│   ├── ui/           # Componentes base (shadcn/ui)
│   ├── shifts/       # Componentes relacionados con turnos
│   ├── chat/         # Componentes del chat
│   └── layout/       # Header, Sidebar, Footer
├── lib/              # Utilidades y configuración
│   ├── supabase/     # Cliente Supabase (server y client)
│   ├── utils.ts      # Funciones helper
│   └── constants.ts  # Constantes de la app
├── hooks/            # Custom React hooks
├── types/            # Tipos TypeScript
├── stores/           # Estado global (Zustand si es necesario)
└── styles/           # Estilos globales
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
- Cliente server-side: `createServerComponentClient` en Server Components
- Cliente client-side: `createClientComponentClient` en Client Components
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
- `users` — Perfil de empleado (extends Supabase auth.users)
- `companies` — Empresas registradas
- `departments` — Departamentos dentro de una empresa
- `shifts` — Turnos publicados para intercambio
- `shift_requests` — Solicitudes de interés en un turno
- `conversations` — Conversaciones entre empleados
- `messages` — Mensajes dentro de conversaciones
- `exchanges` — Intercambios confirmados

### Estados de un Turno (`shifts.status`)
- `open` — Publicado, buscando intercambio
- `pending` — Alguien mostró interés, en negociación
- `confirmed` — Intercambio aceptado por ambas partes
- `completed` — Intercambio realizado
- `cancelled` — Cancelado

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

### Fase 1 — Prototipo (actual)
- [ ] Setup proyecto Next.js + Supabase
- [ ] Autenticación (login/registro)
- [ ] CRUD de turnos
- [ ] Lista de turnos disponibles
- [ ] Botón "Me interesa"

### Fase 2 — Matching
- [ ] Filtro por departamento
- [ ] Notificaciones en app
- [ ] Estados del turno

### Fase 3 — Chat
- [ ] Chat en tiempo real entre empleados

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

## Variables de Entorno Requeridas
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
