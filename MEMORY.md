# MEMORY.md - ShiftSwap Project State

> Este archivo registra decisiones, progreso y contexto importante del proyecto.
> Debe actualizarse despues de cada sesion relevante de desarrollo.

---

## Estado actual
- Fase: Fase 5 - Testing con usuarios / preparacion para piloto
- Ultima actualizacion: 2026-03-25
- Ultimo hito relevante: job positions + official PDF mapping + profile/admin workflow for job position requests
- Estado general: funcionalmente estable, lista para despliegue en produccion si la base de datos tiene aplicadas las migraciones hasta `00024`

## Resumen ejecutivo
- ShiftSwap es una app web interna para intercambio de turnos entre empleados.
- El producto ya cubre autenticacion, validacion manual de empleados, publicacion de turnos, matching, chat, firma en app, aprobacion departamental, roles admin, notificaciones y exportacion PDF.
- El flujo de intercambio ya no depende de descargar, firmar y re-subir un documento para que la logica de negocio funcione.
- El expediente formal vive en la app: acuerdo, firmas, revision de departamento, resolucion y trazabilidad.
- El PDF corporativo de Arcelor es una salida generada por el sistema, no el centro del proceso.
- En smartphone, la navegacion principal ahora usa bottom nav para las 4 secciones de trabajo mas frecuentes y deja cuenta/admin en una capa secundaria.
- `departments` ya soporta jerarquia via `parent_department_id` y ahora distingue nodos operativos elegibles mediante `is_assignable`.
- El registro ya no muestra departamentos en plano: obliga a elegir `empresa -> area/taller -> departamento operativo`.
- El tablon de turnos deja de comportarse como marketplace abierto entre toda la empresa: los usuarios normales solo ven turnos de su departamento exacto.
- El perfil ya muestra area y departamento actual, y permite solicitar cambio de departamento con revision administrativa.
- Existe nueva cola admin en `/admin/department-changes` para aprobar o rechazar traslados entre departamentos operativos.
- El perfil ya muestra tambien el puesto de trabajo actual y permite solicitar cambios de puesto con aprobacion administrativa dentro del mismo departamento operativo.
- Existe nueva cola admin en `/admin/job-position-changes` para aprobar o rechazar solicitudes de cambio de puesto.
- El PDF oficial obligatorio ya usa la jerarquia organizativa correcta: `DPTO. O TALLER` toma el padre del departamento operativo, `Categoria` toma el departamento operativo real y `Puesto de trabajo` toma el puesto asignado del perfil cuando exista.
- Los turnos quedan normalizados por `shift_type`: el horario se deriva de forma fija tanto en UI como en backend y SQL.
- `next.config.ts` aumenta el `bodySizeLimit` de Server Actions a `8mb` para que el registro soporte la subida del carne corporativo sin romperse.
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

### 2026-03-24 - Navegacion movil smartphone-first
- La navegacion principal en movil deja de depender del menu hamburguesa para secciones frecuentes.
- Se adopta bottom navigation fija para:
  - `/shifts`
  - `/shifts/my`
  - `/chat`
  - `/exchanges`
- El avatar del header movil pasa a abrir una capa secundaria para:
  - perfil
  - accesos admin
  - cierre de sesion
- Desktop mantiene header + sidebar como patron principal.
- La fuente de verdad de navegacion se centraliza en `src/components/layout/navigation-items.ts`.
- El layout del dashboard reserva espacio inferior en movil para que la barra fija no tape contenido ni safe areas.

### 2026-03-24 - Jerarquia organizativa de Arcelor en Supabase
- `departments` deja de ser estrictamente plana y pasa a soportar jerarquia con `parent_department_id`.
- Se anade `supabase/migrations/00020_department_hierarchy.sql` para soportar:
  - departamentos raiz
  - subdepartamentos
  - consistencia de empresa entre padre e hijo
  - unicidad por nombre entre hermanos
- Se anade `supabase/seeds/02_arcelor_organization.sql` con estructura inicial de Arcelor:
  - raiz: `Aceria LDG`, `Carril`, `Alambron`, `Otros`
  - hijos bajo `Aceria LDG`: `Produccion`, `Maquinas`, `Mantenimiento mecanico`, `Mantenimiento electrico`
- El seed es idempotente y puede ejecutarse varias veces sin duplicar nodos.
- La app actual ya puede asignar usuarios y turnos a nodos concretos; el filtrado sigue siendo por `department_id` exacto y no expande automaticamente a descendientes.

### 2026-03-24 - Alcance real por departamento y cambio de departamento
- Se anade `supabase/migrations/00021_department_scope_and_change_requests.sql`.
- El modelo organizativo deja de depender solo de la jerarquia y pasa a marcar departamentos operativos con `departments.is_assignable`.
- `Aceria LDG` queda tratada como nodo contenedor no elegible; sus hijos operativos (`Produccion`, `Maquinas`, `Mantenimiento mecanico`, `Mantenimiento electrico`) quedan como destinos validos.
- El registro en `src/app/(auth)/register/*` ahora obliga a seleccionar:
  - empresa
  - area/taller
  - departamento operativo final
- El tablon en `src/app/(dashboard)/shifts/page.tsx` y `src/components/shifts/shift-filters.tsx` restringe la visibilidad al departamento exacto del usuario; el filtro de departamento solo queda disponible para alcance amplio (`hr_admin`, `super_admin`).
- La publicacion de turnos ya no confia en campos ocultos del formulario: el `department_id` sale del perfil autenticado en server action.
- Se endurecen validaciones y RLS para evitar cruces inconsistentes en:
  - `shifts`
  - `shift_requests`
  - `conversations`
  - `exchanges`
- El perfil muestra `area/taller` y `departamento` por separado y anade solicitud de cambio con estado.
- Se crea la entidad `department_change_requests` y un flujo admin minimo en `/admin/department-changes`.
- La aprobacion/rechazo del cambio de departamento se resuelve de forma atomica desde SQL con `resolve_department_change_request(...)`.
- `supabase/seeds/02_arcelor_organization.sql` ahora marca `Aceria LDG` con `is_assignable = FALSE` y los departamentos operativos correspondientes con `TRUE`.
- `next.config.ts` sube `experimental.serverActions.bodySizeLimit` a `8mb` para soportar la carga del carne corporativo en el registro.

### 2026-03-25 - Puestos de trabajo, PDF oficial y perfil laboral
- Se anade `supabase/migrations/00023_job_positions_and_profile_scope.sql` para introducir:
  - `job_positions`
  - `user_profiles.job_position_id`
  - validacion de que cada puesto pertenece a un departamento operativo
  - limpieza automatica de `job_position_id` cuando el perfil deja de pertenecer a ese ambito
- Se anade `supabase/migrations/00024_job_position_change_requests.sql` para soportar solicitudes de cambio de puesto con:
  - registro del puesto actual y solicitado
  - estado `pending/approved/rejected/cancelled`
  - aprobacion SQL atomica via `resolve_job_position_change_request(...)`
  - cancelacion automatica de solicitudes pendientes si cambia el departamento del perfil
- El perfil ahora muestra empresa, area/taller, ID, departamento y puesto de trabajo con layout responsive mas respirado en desktop.
- Se anade `src/app/(dashboard)/profile/job-position-change-request-card.tsx` para que el empleado solicite cambios de puesto sin editar directamente su perfil.
- Se anade la cola admin `/admin/job-position-changes` con acciones para aprobar o rechazar solicitudes.
- El PDF oficial obligatorio se separa en `src/app/api/exchanges/[id]/official-pdf/route.tsx` y usa:
  - `DPTO. O TALLER` = padre del departamento operativo
  - `Categoria` = departamento operativo real
  - `Puesto de trabajo` = puesto asignado del perfil
- La plantilla `src/lib/exchange-official-pdf-document.tsx` se ajusta sin rehacer layout para:
  - dar mas aire a los campos de `SOLICITAN`
  - limpiar la zona de firmas y evitar nombres duplicados
  - renderizar la firma de diligencia/taller con nombre corto en una sola linea
  - usar estilos de fuente compatibles con `@react-pdf/renderer`
- Se anade `supabase/migrations/00022_normalize_shift_schedule.sql` y utilidades en `src/lib/shifts.ts` para fijar horarios segun `shift_type` (`morning`, `afternoon`, `night`) y evitar mezclas inconsistentes.
- El login client-side se endurece para limpiar sesiones locales corruptas si Supabase devuelve errores de refresh token/JWT antes de reintentar el acceso.

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
  - navegacion smartphone-first refinada con bottom nav principal + menu secundario de cuenta
- workflow de 3 actores operativo
- acuerdos de compensacion y base de ledger disponibles
- jerarquia organizativa y puestos de trabajo integrados en perfil, admin y PDF oficial
- pendiente: piloto con usuarios reales y refinamiento sobre feedback

## Problemas conocidos
- El registro hace rollback del usuario auth si falla la escritura del perfil o la subida del carne, pero conviene seguir vigilando errores operativos del bucket `id-cards`.
- Todavia no hay suite automatizada de tests; `package.json` no expone `npm run test`.
- En Windows + OneDrive puede aparecer de forma intermitente un `EPERM` durante `next build` por locks del filesystem en `.next`; no es un fallo estable del codigo si el build vuelve a pasar al reintentar.
- Para produccion, la base de datos debe tener aplicadas al menos `00017` hasta `00024`, incluyendo `00022`, `00023` y `00024` para horarios normalizados, puestos y solicitudes de cambio de puesto.

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
- `00020` anade jerarquia de departamentos con `parent_department_id`.
- `00021` introduce `is_assignable`, visibilidad real por departamento, solicitudes de cambio de departamento y endurecimiento de RLS para alcance organizativo.
- `00022` normaliza `start_time` y `end_time` a partir de `shift_type`.
- `00023` introduce `job_positions` y `user_profiles.job_position_id`.
- `00024` anade `job_position_change_requests` y la aprobacion SQL de cambios de puesto.
- `src/components/layout/navigation-items.ts` centraliza navegacion primaria/secundaria y el calculo de active state entre desktop y movil.
- En movil, la navegacion primaria es la bottom nav; el menu del avatar queda reservado para cuenta y administracion.
- `src/app/(dashboard)/layout.tsx` anade padding inferior especifico en movil para convivir con la bottom nav sin tapar contenido.
- `next.config.ts` configura `experimental.serverActions.bodySizeLimit = "8mb"` por la subida de documentos en registro.

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
- `src/components/layout/header.tsx` - header compartido con logo, notificaciones y acceso secundario de cuenta en movil
- `src/components/layout/sidebar-nav.tsx` - navegacion lateral agrupada en desktop
- `src/components/layout/mobile-bottom-nav.tsx` - navegacion principal fija en smartphone
- `src/components/layout/mobile-nav.tsx` - menu secundario de cuenta/admin para movil
- `src/components/layout/navigation-items.ts` - fuente de verdad de secciones primarias/secundarias y active state
- `src/components/layout/notification-bell.tsx` - centro de notificaciones con badge real
- `src/components/ui/page-header.tsx` - patron reutilizable para cabeceras de pagina
- `src/components/ui/empty-state.tsx` - patron reutilizable para estados vacios
- `supabase/migrations/00020_department_hierarchy.sql` - soporte jerarquico para departamentos
- `supabase/migrations/00021_department_scope_and_change_requests.sql` - elegibilidad operativa, visibilidad por departamento y solicitudes de cambio
- `supabase/migrations/00022_normalize_shift_schedule.sql` - horarios fijos derivados de `shift_type`
- `supabase/migrations/00023_job_positions_and_profile_scope.sql` - puestos de trabajo y relacion opcional con el perfil
- `supabase/migrations/00024_job_position_change_requests.sql` - solicitudes y aprobacion de cambio de puesto
- `supabase/seeds/02_arcelor_organization.sql` - estructura inicial de Arcelor para testing
- `src/lib/departments.ts` - helpers de jerarquia y lectura de area/departamento operativo
- `src/app/(dashboard)/profile/department-change-request-card.tsx` - solicitud de cambio desde perfil
- `src/app/(dashboard)/profile/job-position-change-request-card.tsx` - solicitud de cambio de puesto desde perfil
- `src/app/(dashboard)/admin/department-changes/page.tsx` - cola admin de cambios de departamento
- `src/app/(dashboard)/admin/job-position-changes/page.tsx` - cola admin de cambios de puesto
- `src/components/exchanges/exchange-workflow-progress.tsx` - resumen visual del workflow
- `src/app/(dashboard)/exchanges/[id]/page.tsx` - expediente formal del cambio
- `src/app/(dashboard)/exchanges/actions.ts` - confirmacion, firma, retirada y soporte del expediente
- `src/app/(dashboard)/exchanges/exchange-requester-signature-form.tsx` - bifurcacion entre bolsa de horas e intercambio de turno
- `src/app/(dashboard)/admin/exchanges/page.tsx` - cola de aprobaciones departamentales
- `src/app/(dashboard)/admin/exchanges/actions.ts` - aprobar/rechazar solicitud
- `src/lib/exchange-workflow.ts` - helpers de estados, alcance y trazabilidad
- `src/lib/exchange-compensation.ts` - reglas de compensacion y ledger de deuda
- `src/lib/exchange-official-pdf-document.tsx` - plantilla del PDF oficial obligatorio
- `src/lib/exchange-pdf-document.tsx` - plantilla PDF corporativa
- `src/app/api/exchanges/[id]/official-pdf/route.tsx` - exportacion del PDF oficial obligatorio
- `src/app/api/exchanges/[id]/pdf/route.tsx` - exportacion PDF
- `src/lib/constants.ts` - labels y estilos centralizados de estados y acuerdos
- `src/lib/shifts.ts` - horarios oficiales por `shift_type`
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
- `00020_department_hierarchy.sql` - `parent_department_id`, jerarquia y unicidad entre hermanos
- `00021_department_scope_and_change_requests.sql` - `is_assignable`, RLS de alcance real y `department_change_requests`
- `00022_normalize_shift_schedule.sql` - trigger para imponer horarios oficiales por tipo de turno
- `00023_job_positions_and_profile_scope.sql` - tabla `job_positions` y scope laboral del perfil
- `00024_job_position_change_requests.sql` - solicitudes, RLS y aprobacion SQL de cambios de puesto

## Siguientes pasos recomendados
- Ejecutar piloto con usuarios reales.
- Aplicar migraciones pendientes en Supabase antes de cualquier despliegue productivo.
- Confirmar en produccion que estan aplicadas `00022`, `00023` y `00024` antes de usar el perfil laboral ampliado y el PDF oficial obligatorio.
- Ejecutar `supabase/seeds/02_arcelor_organization.sql` en los entornos de prueba que necesiten estructura Arcelor.
- Recoger friccion de bottom nav movil, comprension de estados y claridad del flujo de intercambio.
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
