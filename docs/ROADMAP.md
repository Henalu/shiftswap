# Roadmap - ShiftSwap

## Estado actual

El producto ya supera el MVP. La app cubre auth endurecida, validacion manual, turnos, propuestas v2, chat, expediente formal, aprobacion departamental, PDFs, estructura organizativa real, calendario laboral y billing foundation. La prioridad ya no es "terminar el MVP", sino cerrar readiness real de piloto y validar el producto con usuarios.

## Bloques cerrados

### Fase 1 - Prototipo

- Setup de Next.js, Supabase, Tailwind y shadcn/ui
- Auth
- CRUD base de turnos
- Listing, detalle y mis turnos

### Fase 2 - Matching

- Filtros por URL
- Contador de resultados
- Cancelacion de turno propio
- Centro de notificaciones

### Fase 3 - Chat

- Lista de conversaciones
- Conversacion individual
- Realtime con fallback por polling
- Notificaciones de nuevos mensajes

### Fase 4 - Workflow formal

- Flujo v2 de propuestas y expediente
- Firma digital en perfil
- Firma del solicitante dentro del expediente
- Aprobacion o rechazo departamental
- Historial de eventos
- PDFs corporativo y oficial
- Soporte documental opcional

### Fase 4.5 - Refresh UX/UI

- Refresh visual para producto interno moderno
- Mejor jerarquia visual
- Mejor sistema de estados
- Bottom nav movil
- Navegacion secundaria de cuenta/admin

### Fase 4.6 - Organizacion, compensacion y perfil laboral

- Jerarquia empresa -> area -> departamento operativo -> puesto
- Cambios de departamento y puesto con cola admin
- `hours_bank` y `shift_exchange`
- Ledger `shift_debt_transactions`

### Fase 4.7 - Billing foundation y seguridad operativa

- Reset de contrasena
- Rate limiting en auth
- Turnstile opcional
- `/billing`
- Checkout, portal y webhook de Stripe
- `health` endpoint
- Runbook operativo

### Fase 4.8 - Calendario laboral

- Turnos `normal_full` y `normal_short`
- Rotaciones 3T5
- Configuracion de jornada por area
- Asignacion de grupos de rotacion
- Vacaciones
- Validacion del calendario al publicar y proponer

## Fase actual

### Fase 5 - Testing con usuarios

- Ejecutar piloto con empleados reales
- Preparar staging con migraciones hasta la ultima de `supabase/migrations/`
- Validar comprension del flujo v2:
  - turno disponible
  - propuesta pendiente
  - propuesta aceptada
  - pendiente de validacion
  - aprobado / rechazado / cancelado
- Validar claridad del calendario:
  - jornada normal
  - 3T5
  - vacaciones
- Medir friccion en:
  - bottom nav
  - filtros
  - propuesta y firma
  - colas admin
  - calendario y vacaciones

### Fase 5.1 - Pilot readiness real

- Staging separado y verificado
- Momento recomendado: abrirlo cuando el siguiente bloque de trabajo ya sea piloto, deploy o validacion externa, no mientras el trabajo siga siendo mayoritariamente interno al repo
- Smoke automatizado ejecutable; en local, 9/9 tests pasan con Supabase local y fixture E2E reparado a 2026-06-02
- Smoke manual de punta a punta
- Cierre local de permisos internos de billing/rate limit aplicado en migracion `20260602103814_lock_internal_billing_and_rate_limit_tables.sql`
- Observabilidad minima:
  - uptime
  - logs
  - alertas de build
- Politica operativa de documentos y rollback

## Siguientes bloques recomendados

### Bloque A - Endurecimiento funcional

- Anadir tests para acciones criticas
- Revisar edge cases y copy de error
- Mejorar trazabilidad operativa
- Endurecer permisos y transiciones sensibles en BD

### Bloque B - Mejora basada en feedback real

- Ajustar jerarquia y copy segun observacion
- Refinar bottom nav si el piloto detecta sobrecarga
- Refinar firma y compensacion si aparecen dudas
- Mejorar onboarding
- Refinar colas admin si crece el volumen

### Bloque C - Salida comercial posterior al piloto

- Activacion real de Stripe
- Emails del ciclo comercial
- Legales revisados
- Onboarding asistido de empresa
- Precedencia `company > user`

### Bloque D - Expansiones post-piloto

- Vista de saldo e historial de bolsa de horas
- Acciones de compensacion
- PWA o app movil
- Integraciones con RRHH
- Push notifications
- Analiticas para managers
- i18n
- modo oscuro

## Criterios de exito del piloto

- Los usuarios entienden por donde empezar sin ayuda.
- En movil, las secciones principales se alcanzan rapido desde la bottom nav.
- El flujo publicar -> proponer -> aceptar -> firmar -> validar se entiende sin confusion grave.
- Los estados del sistema se leen de un vistazo.
- El calendario laboral se entiende sin explicacion externa.
- Los administradores resuelven validaciones, expedientes y configuracion de jornada sin ambiguedad.
- No aparecen regresiones funcionales en lint, build ni smoke automatizado.
