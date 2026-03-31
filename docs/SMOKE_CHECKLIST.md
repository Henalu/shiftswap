# Smoke checklist - ShiftSwap

## Auth

- Registro correcto con documentacion valida
- Rechazo por datos incompletos
- Login correcto
- Login con credenciales incorrectas
- Rate limit en login
- Forgot password
- Reset password

## Acceso y validacion

- Usuario `pending` redirige a `/pending-validation`
- Usuario `approved` entra al dashboard
- Admin aprueba cuenta
- Admin rechaza cuenta

## Turnos y exchanges

- Publicar turno
- Mostrar interes
- Aceptar solicitud
- Crear chat
- Confirmar intercambio
- Firmar ambas partes
- Aprobar desde admin
- Descargar `/api/exchanges/[id]/pdf`
- Descargar `/api/exchanges/[id]/official-pdf`

## Billing

- `/billing` visible para usuario autenticado
- Checkout Stripe redirige correctamente
- Portal Stripe abre si existe customer
- Webhook actualiza suscripcion
- Usuario bloqueado por billing redirige a `/billing`
