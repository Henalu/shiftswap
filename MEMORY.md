# MEMORY.md - ShiftSwap Project State

> Este archivo registra decisiones, progreso y contexto importante del proyecto.
> Debe actualizarse despues de cada sesion relevante de desarrollo.

---

## Estado actual
- Fase: Fase 5 - Testing con usuarios / preparacion para piloto
- Ultima actualizacion: 2026-03-23
- Ultimo hito relevante: native exchange approval workflow + compensation agreements + corporate PDF + internal product UI refresh
- Estado general: funcionalmente estable, lista para despliegue en produccion si la base de datos tiene aplicadas las migraciones hasta `00019`

## Resumen ejecutivo
- ShiftSwap es una app web interna para intercambio de turnos entre empleados.
- El producto ya cubre autenticacion, validacion manual de empleados, publicacion de turnos, matching, chat, firma en app, aprobacion departamental, roles admin, notificaciones y exportacion PDF.
- El flujo de intercambio ya no depende de descargar, firmar y re-subir un documento para que la logica de negocio funcione.
- El expediente formal vive en la app: acuerdo, firmas, revision de departamento, resolucion y trazabilidad.
- El PDF corporativo de Arcelor es una salida generada por el sistema, no el centro del proceso.
- `npm run lint` y `npm run build` pasan con el estado actual del repo.

## Direccion de producto y diseno
- No es una web de marketing ni editorial.
- Es una herramienta operativa donde los usuarios quieren completar tareas rapido y con baja carga cognitiva.
- La direccion visual actual es:
  - limpia
  - eficiente
  - fiable
  - moderna
  - minimalista sin resultar fria
  - muy legible
- Referencias mentales activas:
  - Stripe por limpieza, sistema visual y sensacion de producto pulido
  - Deputy por modelo de producto interno orientado a workforce/scheduling
  - Awwwards solo como referencia de cuidado visual, no como estilo a replicar
- Balance objetivo:
  - 70% claridad funcional
  - 20% pulido moderno
  - 10% personalidad visual
- Fuente persistida para futuras sesiones: `.impeccable.md`

## Decisiones tomadas

### 2026-03-09 - Inicio del proyecto
- Stack elegido: Next.js 16 + Supabase + Tailwind CSS + shadcn/ui
- Razon: velocidad de desarrollo para MVP con auth, DB, realtime y storage resueltos
- Scope base: login, publicar turno, ver turnos, marcar interes, chat, confirmar intercambio y generar documento final
- Idioma del codigo: ingles
- Idioma de la UI: espanol

### 2026-03-10 a 2026-03-18 - Base funcional
- Se consolidan turnos, solicitudes, chat realtime con fallback, centro de notificaciones, validacion manual de empleados y panel admin con roles y alcance por empresa/departamento.
- `user_profiles.role` pasa a ser la fuente de verdad para permisos.
- Se evita recursion RLS en `user_profiles` usando helpers `SECURITY DEFINER`.

### 2026-03-23 - Refresh UX/UI del producto interno
- Se define y persiste una direccion visual explicita en `.impeccable.md`.
- Se refresca el sistema visual para que la app se sienta como un producto interno moderno, claro y fiable.
- Se rehacen tokens, color, tipografia, superficies y estados.
- Se crean patrones reutilizables nuevos:
  - `src/components/ui/page-header.tsx`
  - `src/components/ui/empty-state.tsx`
- Se centralizan labels y estilos de estados en `src/lib/constants.ts`.
- Se mejora navegacion, jerarquia visual, forms, cards, empty states y acciones tactiles.

### 2026-03-23 - Workflow nativo de intercambio y aprobacion
- `exchanges` pasa a comportarse como expediente formal del cambio.
- El workflow principal queda asi:
  - `pending_confirmation`
  - `confirmed`
  - `pending_department_approval`
  - `approved` / `rejected`
  - `completed` / `cancelled`
- La negociacion informal entre empleados se mantiene, pero el acuerdo formal y la resolucion ya viven dentro de la app.
- Las firmas de ambas personas se registran embebidas dentro de la aplicacion.
- Se anade cola de aprobaciones en `/admin/exchanges` para `department_admin`, `hr_admin` y `super_admin`.
- Se anade trazabilidad persistida con `exchange_events`.
- Si el expediente se rechaza o se retira antes de resolverse, el turno vuelve a abrirse.

### 2026-03-23 - Documento corporativo y acuerdos de compensacion
- La exportacion final se genera como PDF corporativo desde `src/app/api/exchanges/[id]/pdf/route.tsx`.
- El layout del PDF se rediseña para ser claro, corporativo y consistente con ShiftSwap y Arcelor.
- El propietario del turno sigue firmando sin pasos adicionales.
- La persona interesada, antes de firmar, debe elegir el tipo de acuerdo:
  - `hours_bank`
  - `shift_exchange`
- `hours_bank` crea una deuda de 1 turno de `user_a` hacia `user_b`.
- `shift_exchange` guarda una fecha futura y un tipo de turno (`morning`, `afternoon`, `night`) sin exigir que exista un turno publicado.
- Se crea la base de ledger `shift_debt_transactions` para soportar historial y saldo de deuda por bolsa de horas.
- El PDF refleja el tipo de acuerdo sin rehacer su composicion general.

### 2026-03-23 - Robustez operativa
- `src/lib/supabase/middleware.ts` se endurece para limpiar sesiones invalidas cuando Supabase devuelve errores de refresh token/JWT.
- En Windows + OneDrive, si `next build` falla por `EPERM` en `.next`, limpiar la carpeta y relanzar el build resuelve el problema.

## Progreso por fase

### Fase 1 - Prototipo
- Completada
- Incluye setup del proyecto, auth, CRUD base de turnos, listing, detalle, interes, mis turnos y navegacion responsive

### Fase 2 - Matching
- Completada
- Incluye filtros en `/shifts`, contador de resultados, cancelar turno propio y campanita de notificaciones

### Fase 3 - Chat
- Completada
- Incluye lista de conversaciones, vista individual, realtime, optimistic update, polling fallback y notificaciones de nuevos mensajes

### Fase 4 - Workflow de intercambio
- Completada
- Incluye `/exchanges`, confirmacion/cancelacion, firmas en app, solicitud formal, aprobacion departamental, PDF corporativo y trazabilidad del expediente

### Fase 5 - Testing con usuarios
- En curso
- Estado real:
  - base funcional cerrada
  - admin y validacion manual disponibles
  - refresh UX/UI aplicado
  - workflow de 3 actores operativo
  - acuerdos de compensacion y base de ledger disponibles
  - pendiente: piloto con usuarios reales y refinamiento sobre feedback

## Problemas conocidos
- El registro puede dejar usuario a medias si falla el `INSERT` en `user_profiles`; conviene endurecer el flujo para evitar estados parciales.
- Todavia no hay suite automatizada de tests; `package.json` no expone `npm run test`.
- En Windows + OneDrive puede aparecer de forma intermitente un `EPERM` durante `next build` por locks del filesystem en `.next`; no es un fallo estable del codigo si el build vuelve a pasar al reintentar.
- Para produccion, la base de datos debe tener aplicadas al menos `00017`, `00018` y `00019`.

## Decisiones tecnicas importantes
- Server Components por defecto; `"use client"` solo cuando es necesario.
- `startConversation` es idempotente.
- `ChatView` es Client Component con Realtime + polling fallback.
- `messages` se filtra client-side en Realtime y se deduplica con `mergeIncomingMessage`.
- Las Server Actions que mutan estado deben devolver `{ success: true }`.
- Los turnos nocturnos son validos; no se impone `end_time > start_time`.
- `createNotification` usa service role en `src/lib/supabase/admin.ts`.
- `notification-utils.ts` centraliza `action_url` y fallbacks de navegacion.
- `read` quita una notificacion del badge; `resolved_at` la saca del inbox activo.
- `00010` es obligatoria para chat realtime.
- `00014` es obligatoria para el centro de notificaciones.
- `00018` modela workflow nativo, firmas embebidas, aprobacion y `exchange_events`.
- `00019` modela acuerdos de compensacion y `shift_debt_transactions`.

## Sistema visual actual
- Fuente principal: `Manrope`
- El estilo visual prioriza contraste suave, claridad y ritmo por encima de decoracion.
- Los colores se usan sobre todo para semantica:
  - exito
  - warning
  - pending
  - cancelacion
  - estados activos
- Los componentes nuevos deben seguir estos patrones:
  - cabeceras con `PageHeader`
  - estados vacios con `EmptyState`
  - formularios con `FORM_CONTROL_CLASSNAME` cuando no exista componente shadcn equivalente
  - paneles y superficies con `PANEL_CLASSNAME`
  - badges de estado desde `src/lib/constants.ts`

## Archivos clave
- `src/app/(dashboard)/layout.tsx` - layout protegido del dashboard
- `src/components/layout/header.tsx` - header con mobile nav, avatar y NotificationBell
- `src/components/layout/sidebar-nav.tsx` - navegacion lateral agrupada
- `src/components/layout/notification-bell.tsx` - centro de notificaciones con badge real
- `src/components/ui/page-header.tsx` - patron reutilizable para cabeceras de pagina
- `src/components/ui/empty-state.tsx` - patron reutilizable para estados vacios
- `src/components/exchanges/exchange-workflow-progress.tsx` - resumen visual del workflow
- `src/app/(dashboard)/exchanges/[id]/page.tsx` - expediente formal del cambio
- `src/app/(dashboard)/exchanges/actions.ts` - confirmacion, firma, retirada y soporte del expediente
- `src/app/(dashboard)/exchanges/exchange-requester-signature-form.tsx` - bifurcacion entre bolsa de horas e intercambio de turno
- `src/app/(dashboard)/admin/exchanges/page.tsx` - cola de aprobaciones departamentales
- `src/app/(dashboard)/admin/exchanges/actions.ts` - aprobar/rechazar solicitud
- `src/lib/exchange-workflow.ts` - helpers de estados, alcance y trazabilidad
- `src/lib/exchange-compensation.ts` - reglas de compensacion y ledger de deuda
- `src/lib/exchange-pdf-document.tsx` - plantilla PDF corporativa
- `src/app/api/exchanges/[id]/pdf/route.tsx` - exportacion PDF
- `src/lib/constants.ts` - labels y estilos centralizados de estados y acuerdos
- `src/lib/utils.ts` - utilidades visuales y helpers compartidos

## Migraciones importantes
- `00010_enable_realtime_for_messages.sql` - publica `messages` en Realtime
- `00011_exchange_signatures_and_documents.sql` - soporte documental y firmas base
- `00012_signed_exchange_cancellation_requests.sql` - base historica de retirada reciproca
- `00013_notifications_center.sql` - notifications realtime + trigger `new_message`
- `00014_notification_center_state_and_dedupe.sql` - dedupe, read/resolved state y nuevos tipos
- `00015_employee_validation.sql` - validacion manual de empleados
- `00016_roles_and_permissions.sql` - roles, alcance admin y helpers de permisos
- `00017_allow_word_exchange_documents.sql` - soporte Word/PDF en `exchange-documents`
- `00018_native_exchange_approval_workflow.sql` - workflow nativo, aprobacion departamental y `exchange_events`
- `00019_exchange_compensation_terms_and_ledger.sql` - acuerdos de compensacion y ledger `shift_debt_transactions`

## Siguientes pasos recomendados
- Ejecutar piloto con usuarios reales.
- Aplicar migraciones pendientes en Supabase antes de cualquier despliegue productivo.
- Recoger friccion de navegacion, comprension de estados y claridad del flujo de intercambio.
- Endurecer el flujo de registro para evitar usuarios parciales.
- Introducir una base minima de tests para acciones criticas.
- Construir una vista dedicada de historial/saldo para `shift_debt_transactions` si la bolsa de horas se vuelve flujo habitual.

## Ideas futuras
- PWA o app movil
- Integracion con sistemas de RRHH
- Notificaciones push
- Analiticas para managers
- i18n
- modo oscuro

## Contacto del proyecto
- Developer: Henalu
- Email: henaludebarros@hotmail.com
