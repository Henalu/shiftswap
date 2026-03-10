# MEMORY.md — ShiftSwap Project State

> Este archivo registra decisiones, progreso y contexto importante del proyecto.
> Actualizar después de cada sesión de desarrollo.

---

## Estado Actual
**Fase:** Fase 4 — Confirmación y PDF (siguiente)
**Última actualización:** 2026-03-10

## Decisiones Tomadas

### 2026-03-09 — Inicio del proyecto
- **Stack elegido:** Next.js 16 + Supabase + Tailwind + shadcn/ui
- **Razón:** Velocidad de desarrollo para MVP, Supabase cubre auth + DB + realtime + storage
- **Modelo:** B2B SaaS (la empresa paga, no el empleado)
- **MVP scope:** Login, publicar turno, ver turnos, marcar interés, chat simple, confirmar intercambio, generar PDF
- **Idioma del código:** Inglés (variables, commits, comentarios técnicos)
- **Idioma de la UI:** Español (primera versión, i18n futuro)

### 2026-03-10 — Decisiones de arquitectura
- **SidebarNav** extraído como Client Component separado para soportar active state con `usePathname()`
- **Filtros** implementados via URL searchParams (bookmarkables, compatibles con Server Components)
- **acceptRequest** llama `revalidatePath("/shifts")` — el turno desaparece del listing al aceptarse
- **Seed de datos** usa UUIDs fijos para poder ser idempotente (re-ejecutable sin duplicados)

## Progreso por Fase

### Fase 1 — Prototipo ✅ COMPLETADA
| Tarea | Estado | Fecha |
|-------|--------|-------|
| Crear estructura del proyecto | ✅ Hecho | 2026-03-09 |
| Setup Next.js 16 + TypeScript | ✅ Hecho | 2026-03-09 |
| Setup Supabase (client/server/middleware) | ✅ Hecho | 2026-03-09 |
| Configurar Tailwind + shadcn/ui | ✅ Hecho | 2026-03-09 |
| Crear esquema de base de datos (migrations) | ✅ Hecho | 2026-03-09 |
| Autenticación — login page | ✅ Hecho | 2026-03-09 |
| Autenticación — register page | ✅ Hecho | 2026-03-09 |
| Formulario publicar turno (/shifts/new) | ✅ Hecho | 2026-03-09 |
| Lista de turnos disponibles (/shifts) | ✅ Hecho | 2026-03-09 |
| Detalle de turno (/shifts/[id]) | ✅ Hecho | 2026-03-09 |
| Botón "Me interesa" (shift_requests insert) | ✅ Hecho | 2026-03-09 |
| Página "Mis turnos" (/shifts/my) | ✅ Hecho | 2026-03-10 |
| Aceptar / rechazar solicitud (owner del turno) | ✅ Hecho | 2026-03-10 |
| Sidebar desktop con active state (SidebarNav) | ✅ Hecho | 2026-03-10 |
| Barra de navegación mobile en Header | ✅ Hecho | 2026-03-10 |
| Seed de datos (empresa + 3 departamentos) | ✅ Hecho | 2026-03-10 |
| Configurar .env.local con keys de Supabase | ✅ Hecho | 2026-03-10 |

### Fase 2 — Matching (en curso)
| Tarea | Estado | Fecha |
|-------|--------|-------|
| Filtros en /shifts (departamento, tipo, fechas) | ✅ Hecho | 2026-03-10 |
| Contador de resultados con filtros aplicados | ✅ Hecho | 2026-03-10 |
| Revalidación consistente al aceptar solicitud | ✅ Hecho | 2026-03-10 |
| Cancelar turno propio desde /shifts/my (CancelShiftButton) | ✅ Hecho | 2026-03-10 |
| Notificaciones in-app (NotificationBell + Realtime) | ✅ Hecho | 2026-03-10 |
| SidebarNav como Client Component independiente | ✅ Hecho | 2026-03-10 |

### Fase 3 — Chat ✅ COMPLETADA
| Tarea | Estado | Fecha |
|-------|--------|-------|
| Lista de conversaciones (/chat) | ✅ Hecho | 2026-03-10 |
| Página de conversación individual (/chat/[id]) | ✅ Hecho | 2026-03-10 |
| ChatView — Realtime, burbujas, auto-scroll, input | ✅ Hecho | 2026-03-10 |
| startConversation server action (idempotente) | ✅ Hecho | 2026-03-10 |
| Botón "Enviar mensaje" en detalle de turno | ✅ Hecho | 2026-03-10 |
| RLS policies para chat (migrations 00003) | ✅ Hecho | 2026-03-10 |

### Fase 4 — Confirmación
| Tarea | Estado | Fecha |
|-------|--------|-------|
| Flujo de confirmación de intercambio | ⬜ Pendiente | — |
| Generación de documento PDF | ⬜ Pendiente | — |

## Problemas Conocidos
- Páginas `/profile` y `/exchanges` son placeholders vacíos
- RLS de `companies` y `departments` requieren política pública para el flujo de registro (ya aplicada en Supabase manualmente — pendiente añadir a migrations)
- El registro puede dejar usuario a medias si falla el INSERT en `user_profiles` — mejorar manejo de errores en register page
- `@base-ui/react` eliminado y reemplazado por Radix UI puro — todos los componentes shadcn reescritos

## Decisiones Técnicas Importantes
- **@base-ui/react eliminado** — causaba conflictos con shadcn/ui. Todos los componentes UI ahora usan Radix UI directamente
- **ChatView** es Client Component con Supabase Realtime subscription
- **startConversation** es idempotente — busca conversación existente antes de crear una nueva
- **migrations/00003** incluye RLS de chat y fix del CHECK constraint de notifications

## Archivos Clave
| Archivo | Descripción |
|---------|-------------|
| `src/app/(dashboard)/layout.tsx` | Layout protegido con Header + SidebarNav |
| `src/components/layout/sidebar-nav.tsx` | Client Component con active state |
| `src/components/layout/header.tsx` | Header con mobile nav + avatar dropdown |
| `src/app/(dashboard)/shifts/page.tsx` | Lista turnos open + filtros URL searchParams |
| `src/app/(dashboard)/shifts/[id]/page.tsx` | Detalle turno + interesados |
| `src/app/(dashboard)/shifts/my/page.tsx` | Mis turnos + aceptar/rechazar solicitudes |
| `src/app/(dashboard)/shifts/my/actions.ts` | acceptRequest / rejectRequest server actions |
| `src/app/(dashboard)/shifts/new/actions.ts` | createShift server action |
| `src/components/shifts/interest-button.tsx` | Botón "Me interesa" client component |
| `supabase/migrations/00001_initial_schema.sql` | Schema completo con RLS |
| `supabase/seeds/01_demo_data.sql` | 1 empresa + 3 departamentos (UUIDs fijos) |

## Ideas para Futuro (post-MVP)
- App móvil (React Native o PWA)
- Rol de Supervisor/Manager con panel de aprobación
- Integración con sistemas de RRHH existentes
- Calendario inteligente con predicción de cobertura
- Multi-idioma (i18n)
- Modo oscuro
- Notificaciones push
- Analíticas para managers

## Notas Técnicas
- **Next.js 16** con App Router — `params` y `searchParams` son `Promise<...>`, hay que hacer `await`
- Supabase RLS activado en todas las tablas — siempre respetar las políticas
- Supabase Realtime para chat y notificaciones (Fase 3)
- Server Components por defecto, `"use client"` solo cuando sea necesario
- Autenticación con Supabase Auth (email/password para MVP, OAuth futuro)
- Filtros via URL searchParams para que sean bookmarkables y funcionen con Server Components

## Contacto del Proyecto
- **Developer:** Henalu
- **Email:** henaludebarros@hotmail.com
