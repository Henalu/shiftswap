# Roadmap - ShiftSwap

## Estado actual

El producto ya supera el MVP inicial. La app cubre auth, turnos, matching, chat, workflow formal de intercambio, firmas en app, aprobacion departamental, PDF corporativo, validacion manual y roles admin. La prioridad ya no es "terminar el MVP", sino validar el producto con usuarios reales y endurecerlo para uso interno.

## Fases cerradas

### Fase 1 - Prototipo
- Setup de Next.js, Supabase, Tailwind y shadcn/ui
- Auth
- CRUD base de turnos
- Listing y detalle
- Flujo de interes
- Mis turnos

### Fase 2 - Matching
- Filtros por URL
- Contador de resultados
- Cancelacion de turno propio
- Centro de notificaciones inicial

### Fase 3 - Chat
- Lista de conversaciones
- Conversacion individual
- Realtime con fallback por polling
- Notificaciones de nuevos mensajes

### Fase 4 - Workflow de intercambio
- Exchanges y detalle de expediente
- Confirmacion de acuerdo entre empleados
- Firmas embebidas dentro de la app
- Aprobacion/rechazo por departamento
- Historial de eventos del expediente
- PDF corporativo generado por el sistema
- Soporte documental opcional
- Perfil con avatar upload
- Validacion manual de empleados
- Roles y panel admin

### Fase 4.5 - Refresh UX/UI
- Redefinicion visual del producto para orientarlo a un internal product moderno
- Sistema visual mas claro y coherente
- Mejor navegacion
- Mejor jerarquia visual
- Mejor sistema de estados
- Forms, empty states y cards mas legibles

### Fase 4.6 - Compensacion y bolsa de horas
- Seleccion de acuerdo en la firma del solicitante
- `hours_bank` como compensacion con deuda registrada
- `shift_exchange` con fecha futura y tipo de turno acordado
- Base de ledger `shift_debt_transactions`

## Fase actual

### Fase 5 - Testing con usuarios
- Ejecutar piloto con empleados reales
- Medir si la navegacion y el flujo de intercambio se entienden sin explicacion
- Validar la claridad de estados:
  - turno disponible
  - solicitud pendiente
  - acuerdo pendiente de confirmacion
  - pendiente de firmas
  - pendiente de aprobacion
  - aprobado / rechazado / cancelado
- Validar la comprension de los acuerdos de compensacion:
  - bolsa de horas
  - intercambio de turno futuro
- Recoger friccion en:
  - filtros
  - chat
  - firma y compensacion
  - aprobacion departamental
  - panel admin

## Siguientes bloques recomendados

### Bloque A - Endurecimiento funcional
- Evitar usuarios parciales si falla el alta
- Anadir tests para acciones criticas
- Revisar estados edge case y copy de errores
- Mejorar trazabilidad de errores operativos
- Endurecer politicas y permisos a nivel de BD para transiciones sensibles

### Bloque B - Mejora basada en feedback real
- Ajustar jerarquia y copy segun observacion de usuarios
- Refinar el paso de firma/compensacion si aparecen dudas en piloto
- Mejorar onboarding para usuarios nuevos
- Refinar pantallas admin si el volumen de aprobaciones y validaciones crece

### Bloque C - Expansiones post-piloto
- Vista dedicada de saldo e historial de bolsa de horas
- Acciones de compensacion/cierre de deuda
- PWA o app movil
- Integraciones con RRHH
- Notificaciones push
- Analiticas para managers
- i18n
- modo oscuro

## Criterios para considerar el piloto exitoso

- Los usuarios entienden por donde empezar sin ayuda.
- El flujo publicar -> interes -> chat -> firma -> aprobacion se completa sin confusion grave.
- Los estados del sistema se entienden de un vistazo.
- La diferencia entre `bolsa de horas` e `intercambio de turno` se entiende sin explicacion externa.
- Los administradores pueden validar cuentas, gestionar roles y resolver expedientes sin ambiguedad.
- No aparecen regresiones funcionales en lint/build ni errores frecuentes de UX bloqueante.
