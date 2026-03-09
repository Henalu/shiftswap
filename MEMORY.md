# MEMORY.md — ShiftSwap Project State

> Este archivo registra decisiones, progreso y contexto importante del proyecto.
> Actualizar después de cada sesión de desarrollo.

---

## Estado Actual
**Fase:** Pre-desarrollo (setup inicial)
**Última actualización:** 2026-03-09

## Decisiones Tomadas

### 2026-03-09 — Inicio del proyecto
- **Stack elegido:** Next.js + Supabase + Tailwind + shadcn/ui
- **Razón:** Velocidad de desarrollo para MVP, Supabase cubre auth + DB + realtime + storage
- **Modelo:** B2B SaaS (la empresa paga, no el empleado)
- **MVP scope:** Login, publicar turno, ver turnos, marcar interés, chat simple, confirmar intercambio, generar PDF
- **Idioma del código:** Inglés (variables, commits, comentarios técnicos)
- **Idioma de la UI:** Español (primera versión, i18n futuro)

## Progreso por Fase

### Fase 1 — Prototipo
| Tarea | Estado | Fecha |
|-------|--------|-------|
| Crear estructura del proyecto | ✅ Hecho | 2026-03-09 |
| Setup Next.js + TypeScript | ⬜ Pendiente | — |
| Setup Supabase | ⬜ Pendiente | — |
| Configurar Tailwind + shadcn/ui | ⬜ Pendiente | — |
| Crear esquema de base de datos | ⬜ Pendiente | — |
| Implementar autenticación | ⬜ Pendiente | — |
| CRUD de turnos | ⬜ Pendiente | — |
| Lista de turnos disponibles | ⬜ Pendiente | — |
| Botón "Me interesa" | ⬜ Pendiente | — |

### Fase 2 — Matching
| Tarea | Estado | Fecha |
|-------|--------|-------|
| Filtro por departamento | ⬜ Pendiente | — |
| Notificaciones in-app | ⬜ Pendiente | — |
| Sistema de estados | ⬜ Pendiente | — |

### Fase 3 — Chat
| Tarea | Estado | Fecha |
|-------|--------|-------|
| Chat realtime | ⬜ Pendiente | — |

### Fase 4 — Confirmación
| Tarea | Estado | Fecha |
|-------|--------|-------|
| Flujo de confirmación | ⬜ Pendiente | — |
| Generación de PDF | ⬜ Pendiente | — |

## Problemas Conocidos
- Ninguno aún (proyecto en fase inicial)

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
- Supabase provee Row Level Security (RLS) — usarlo siempre
- Supabase Realtime para chat y notificaciones
- Next.js App Router (no Pages Router)
- Server Components por defecto, Client Components solo cuando sea necesario
- Autenticación con Supabase Auth (email/password para MVP, OAuth futuro)

## Contacto del Proyecto
- **Developer:** Henalu
- **Email:** henaludebarros@hotmail.com
