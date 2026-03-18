# MEMORY.md — ShiftSwap Project State

> Este archivo registra decisiones, progreso y contexto importante del proyecto.
> Actualizar después de cada sesión de desarrollo.

---

## Estado Actual
**Fase:** Fase 5 — Testing con usuarios (siguiente)
**Última actualización:** 2026-03-16

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

### 2026-03-13 — Ajustes de flujo y documentación
- **/exchanges listing** expone `Confirmar` y `Cancelar` directamente en la card cuando el usuario autenticado es `user_b` y el estado es `pending_confirmation`
- **confirmExchange / cancelExchange** se reutilizan sin cambios desde el listing; la revalidación de `/exchanges` sigue centralizada en las server actions
- **MEMORY.md** y **CLAUDE.md** se alinean con el estado real del repo: `/profile` y `/exchanges` ya no son placeholders, y `00009_shift_requests_update_policies.sql` ya forma parte de las migraciones versionadas

### 2026-03-13 — Realtime y estabilidad de build
- **Chat realtime**: el problema de sincronización entre participantes se cubre en dos capas: migración `00010_enable_realtime_for_messages.sql` para añadir `messages` a `supabase_realtime`, y polling fallback en `chat-view.tsx` cada 3 segundos si Realtime no entrega eventos
- **ChatView** extrae `mergeIncomingMessage` para deduplicar mensajes, reemplazar optimistas y mantener orden por `created_at`
- **DropdownMenuTrigger** se reescribe como wrapper con `React.forwardRef` para preservar props de Radix y evitar errores de TypeScript en Vercel
- **PDF route** convierte `Buffer` a `Uint8Array` antes de `new Response(...)` para evitar fallo de build en `src/app/api/exchanges/[id]/pdf/route.tsx`

### 2026-03-14 — Cierre del flujo de exchanges y centro de notificaciones
- **Estado `signed`** añadido a `exchanges`: el intercambio deja de terminar en `confirmed` y pasa a requerir PDF adjunto + firma por ambas partes (`signed_by_user_a_at`, `signed_by_user_b_at`)
- **Cancelación recíproca en `signed`**: se añaden `cancellation_requested_by` y `cancellation_requested_at`; una parte solicita y la otra confirma o rechaza. Mientras tanto, el exchange sigue en `signed`
- **Unificación de navegación**: `/shifts/[id]` y `/shifts/my` dejan de representar un caso activo como “turno en negociación” si ya existe exchange; el detalle canónico pasa a ser `/exchanges/[id]`
- **NotificationBell** pasa a centro real de notificaciones: badge global, dropdown navegable, marcado individual o masivo como leído y soporte de `action_url`
- **Chat -> notifications**: los mensajes generan `notifications` de tipo `new_message` desde trigger SQL (`00013_notifications_center.sql`), no desde cliente
- **createNotification** deja de depender del cliente autenticado y pasa a usar `SUPABASE_SERVICE_ROLE_KEY` via helper admin para evitar fallos silenciosos por RLS en inserts a terceros

### 2026-03-16 — Centro de notificaciones escalable y corrección de chat móvil
- **Notifications con ciclo de vida**: se añaden `dedupe_key`, `read_at`, `resolved_at` y `updated_at` con la migración `00014_notification_center_state_and_dedupe.sql`
- **Badge coherente**: la campanita cuenta solo notificaciones no leídas y no resueltas, y permite descartar individualmente avisos ya atendidos
- **Cobertura funcional ampliada**: además de chat, ahora se notifican interés en turno, aceptación/rechazo, cancelación de turno, documentos adjuntos, firma y cancelaciones de intercambios
- **Marcado contextual**: abrir detalles de chat, turno o intercambio marca o resuelve las notificaciones relacionadas para evitar badges fantasma
- **Chat móvil**: el auto-scroll solo baja al abrir la conversación o cuando entra un mensaje pertinente; ya no secuestra el scroll cuando el usuario revisa mensajes antiguos

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

### Fase 2 — Matching ✅ COMPLETADA
| Tarea | Estado | Fecha |
|-------|--------|-------|
| Filtros en /shifts (departamento, tipo, fechas) | ✅ Hecho | 2026-03-10 |
| Contador de resultados con filtros aplicados | ✅ Hecho | 2026-03-10 |
| Revalidación consistente al aceptar solicitud | ✅ Hecho | 2026-03-10 |
| Cancelar turno propio desde /shifts/my (CancelShiftButton) | ✅ Hecho | 2026-03-10 |
| Notificaciones in-app (NotificationBell + Realtime) | ✅ Hecho | 2026-03-10 |
| Campanita como centro navegable de notificaciones | ✅ Hecho | 2026-03-14 |
| Centro de notificaciones con dedupe y estado read/resolved | ✅ Hecho | 2026-03-16 |
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
| Realtime de `messages` publicado via migration 00010 | ✅ Hecho | 2026-03-13 |
| Polling fallback en `ChatView` para entornos sin Realtime operativo | ✅ Hecho | 2026-03-13 |
| Notificaciones globales `new_message` vía trigger SQL + marcado leído al abrir conversación | ✅ Hecho | 2026-03-14 |
| Auto-scroll móvil solo en carga inicial o mensajes nuevos pertinentes | ✅ Hecho | 2026-03-16 |

### Fase 4 — Confirmación ✅ COMPLETADA
| Tarea | Estado | Fecha |
|-------|--------|-------|
| Página `/exchanges` con listado de intercambios | ✅ Hecho | 2026-03-12 |
| Confirmar / cancelar desde `/exchanges/[id]` | ✅ Hecho | 2026-03-12 |
| Confirmar / cancelar directo en card de `/exchanges` cuando confirma `user_b` | ✅ Hecho | 2026-03-13 |
| Estado `signed` con PDF adjunto y firma de ambas partes | ✅ Hecho | 2026-03-14 |
| Cancelación recíproca en intercambios firmados | ✅ Hecho | 2026-03-14 |
| Unificación `/shifts/my` -> `/exchanges/[id]` cuando ya existe intercambio activo | ✅ Hecho | 2026-03-14 |
| Generación de documento PDF | ✅ Hecho | 2026-03-12 |
| Página de perfil con avatar upload | ✅ Hecho | 2026-03-12 |

## Problemas Conocidos
- El registro puede dejar usuario a medias si falla el INSERT en `user_profiles` — mejorar manejo de errores en register page
- No hay suite de tests automatizados configurada todavía (`package.json` no expone `npm run test`)
- `@base-ui/react` eliminado y reemplazado por Radix UI puro — todos los componentes shadcn reescritos
- `npm run build` en Windows local puede terminar con `spawn EPERM` tras compilar y pasar TypeScript; no reproduce por sí mismo un fallo de Vercel, pero dificulta usar el build local como verificación final

## Decisiones Técnicas Importantes
- **@base-ui/react eliminado** — causaba conflictos con shadcn/ui. Todos los componentes UI ahora usan Radix UI directamente
- **ChatView** es Client Component con Supabase Realtime subscription y polling fallback para resiliencia en despliegues donde `messages` aún no está publicado
- **startConversation** es idempotente — busca conversación existente antes de crear una nueva
- **migrations/00003** incluye RLS de chat y fix del CHECK constraint de notifications
- **migrations/00009** añade las UPDATE policies que faltaban en `shift_requests` para aceptar/rechazar solicitudes y retirar interés sin que RLS filtre silenciosamente el update
- **migrations/00010** añade `messages` a `supabase_realtime` para que `postgres_changes` entregue inserts de chat a ambos participantes
- **migrations/00011** introduce `signed`, bucket `exchange-documents` y firmas por participante para el cierre documental del intercambio
- **migrations/00012** añade solicitud de cancelación recíproca en exchanges firmados sin crear un estado principal extra
- **migrations/00013** añade `notifications` a Realtime y crea trigger SQL `new_message` para alimentar la campanita global desde la base de datos
- **migrations/00014** amplía `notifications` con `dedupe_key`, `read_at`, `resolved_at`, `updated_at` y nuevos tipos para soportar el centro de notificaciones completo
- **DropdownMenuTrigger** usa wrapper tipado con `forwardRef` para que los componentes Radix compilen correctamente en Vercel
- **Route Handler de PDF** convierte `Buffer` a `Uint8Array` antes de `Response` para cumplir el tipado de Next.js/Web API
- **createNotification** usa service role (`src/lib/supabase/admin.ts`) para crear notificaciones a terceros sin depender de políticas `INSERT` del usuario autenticado
- **notification-utils.ts** centraliza la resolución de `action_url` y fallbacks por entidad para que la campanita no duplique lógica de routing
- **`read` vs `resolved`**: leer una notificación quita el badge; resolverla la saca del inbox activo cuando el evento ya no requiere atención

## Archivos Clave
| Archivo | Descripción |
|---------|-------------|
| `src/app/(dashboard)/layout.tsx` | Layout protegido con Header + SidebarNav |
| `src/components/layout/sidebar-nav.tsx` | Client Component con active state |
| `src/components/layout/header.tsx` | Header con mobile nav + avatar dropdown + NotificationBell |
| `src/components/layout/notification-bell.tsx` | Centro de notificaciones con badge, leído/no leído y navegación |
| `src/components/ui/dropdown-menu.tsx` | Wrapper shadcn/Radix con `DropdownMenuTrigger` tipado |
| `src/lib/supabase/admin.ts` | Cliente service role para operaciones server-only como notifications |
| `src/lib/notification-utils.ts` | Resolución de destinos (`action_url`, fallbacks por entidad) |
| `src/lib/notifications.ts` | Helpers de create/read/resolve con filtros y dedupe |
| `src/app/(dashboard)/shifts/page.tsx` | Lista turnos open + filtros URL searchParams |
| `src/app/(dashboard)/shifts/[id]/page.tsx` | Detalle turno + interesados |
| `src/app/(dashboard)/shifts/my/page.tsx` | Mis turnos + aceptar/rechazar solicitudes |
| `src/app/(dashboard)/shifts/my/actions.ts` | acceptRequest / rejectRequest server actions |
| `src/app/(dashboard)/chat/[id]/chat-view.tsx` | Vista de conversación con Realtime, optimistic update y polling fallback |
| `src/app/(dashboard)/exchanges/page.tsx` | Lista de intercambios + signed + cancelación recíproca |
| `src/app/(dashboard)/exchanges/actions.ts` | confirm/cancel + sign + signed cancellation flow |
| `src/app/api/exchanges/[id]/pdf/route.tsx` | Route Handler del PDF con respuesta tipada para build de producción |
| `src/app/(dashboard)/profile/page.tsx` | Perfil del usuario autenticado |
| `src/app/(dashboard)/profile/actions.ts` | updateProfile server action |
| `src/app/(dashboard)/shifts/new/actions.ts` | createShift server action |
| `src/components/shifts/interest-button.tsx` | Botón "Me interesa" client component |
| `src/components/shifts/cancel-shift-button.tsx` | Confirmación UI para cancelar turno propio |
| `supabase/migrations/00001_initial_schema.sql` | Schema completo con RLS |
| `supabase/migrations/00009_shift_requests_update_policies.sql` | UPDATE policies faltantes para `shift_requests` |
| `supabase/migrations/00010_enable_realtime_for_messages.sql` | Publica `messages` en `supabase_realtime` |
| `supabase/migrations/00011_exchange_signatures_and_documents.sql` | Estado `signed`, bucket PDF adjunto y firmas |
| `supabase/migrations/00012_signed_exchange_cancellation_requests.sql` | Solicitud de cancelación recíproca en `signed` |
| `supabase/migrations/00013_notifications_center.sql` | Notifications Realtime + trigger `new_message` |
| `supabase/migrations/00014_notification_center_state_and_dedupe.sql` | Dedupe, read/resolved state y nuevos tipos de notifications |
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
- `messages` usa filtro client-side en Realtime y polling fallback; la sincronización completa depende de aplicar también la migración `00010` en la base de datos activa
- El centro de notificaciones depende también de aplicar `00014_notification_center_state_and_dedupe.sql` para que el badge, el dedupe y la resolución funcionen como en el repo
- Server Components por defecto, `"use client"` solo cuando sea necesario
- Autenticación con Supabase Auth (email/password para MVP, OAuth futuro)
- Filtros via URL searchParams para que sean bookmarkables y funcionen con Server Components

## Contacto del Proyecto
- **Developer:** Henalu
- **Email:** henaludebarros@hotmail.com

## 2026-03-18 â€” ValidaciÃ³n manual de empleados y perfil consolidado
- **ValidaciÃ³n manual:** el alta ahora sigue el flujo registro â†’ evidencia â†’ revisiÃ³n admin â†’ activaciÃ³n, con `employee_id`, bucket privado `id-cards`, estados `pending/approved/rejected` y panel `/admin/validations`
- **Dashboard gated:** el middleware deja entrar al dashboard solo a usuarios `approved`; `pending` y `rejected` se redirigen a `/pending-validation`
- **Perfil consolidado:** `/profile` muestra tres bloques fijos (avatar, informaciÃ³n personal editable, informaciÃ³n laboral readonly) y un badge visual `Cuenta verificada`
- **Campos laborales inmutables:** empresa, `employee_id` y departamento ya no se editan desde el perfil; `updateProfile` solo toca `full_name`, `phone`, `email` y `avatar_url`
- **Lectura server-side:** los campos protegidos del perfil validado se resuelven en servidor con service role para no debilitar el endurecimiento de permisos sobre `user_profiles`
## 2026-03-18 Ã¢â‚¬â€ Roles con alcance y nuevo panel de administraciÃƒÂ³n
- **`role` reemplaza `is_admin`:** el sistema pasa a `member`, `department_admin`, `hr_admin` y `super_admin`; `is_admin` queda solo como compatibilidad temporal
- **Panel admin integrado en `(dashboard)`:** `/admin/validations` y `/admin/users` reutilizan el layout principal con `Header` y `SidebarNav`
- **ProtecciÃƒÂ³n por capas:** el middleware bloquea `/admin/*` para `member`, y `src/app/(dashboard)/admin/layout.tsx` repite la validaciÃƒÂ³n como segunda barrera
- **RLS sin recursiÃƒÂ³n:** `user_profiles` usa funciones `SECURITY DEFINER` (`get_user_role`, `get_user_company`, `get_user_department`) para aplicar scope sin caer en `42P17`
- **Alcance por rol:** `department_admin` queda limitado a empresa+departamento, `hr_admin` a empresa completa y `super_admin` a todo el sistema
- **Cambio de roles:** solo `super_admin` puede promocionar o degradar usuarios desde `/admin/users`
- **Safeguard de plataforma:** no se permite degradar al Ãºltimo `super_admin`, evitando dejar el sistema sin nadie capaz de gestionar permisos
- **Compatibilidad funcional:** se preserva la lectura de perfiles `approved` dentro de la misma empresa para no romper los joins existentes de turnos, chat e intercambios
