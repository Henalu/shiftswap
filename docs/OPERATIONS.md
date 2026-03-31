# Operacion y despliegue - ShiftSwap

## Objetivo

Esta guia deja una base minima para operar ShiftSwap en staging y produccion
con menos riesgo durante el piloto y antes de activar billing real.

## Entornos recomendados

- `local`: desarrollo y pruebas rapidas
- `staging`: mismo flujo que produccion, pero con datos y claves separadas
- `production`: entorno real para usuarios

## Variables de entorno nuevas

- `BILLING_ENABLED`
- `BILLING_MODE`
- `BILLING_ENFORCEMENT`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_USER_MONTHLY_PRICE_ID`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## Checklist de despliegue

1. Aplicar migraciones de Supabase hasta la ultima disponible.
2. Confirmar que staging y production usan proyectos Supabase distintos.
3. Verificar buckets:
   - `avatars`
   - `exchange-documents`
   - `id-cards`
4. Verificar ruta de health:
   - `GET /api/health`
5. Verificar auth:
   - login
   - register
   - forgot password
   - reset password
6. Verificar flujo operativo:
   - publicar turno
   - interes
   - chat
   - confirmacion
   - aprobacion
   - PDFs
7. Si billing esta activo:
   - checkout
   - portal
   - webhook Stripe

## Backups y rollback

- Supabase debe tener backups automáticos activados.
- Antes de cada despliegue sensible:
  - exportar snapshot o confirmar backup reciente
  - registrar numero de migracion objetivo
- Si una migracion rompe el entorno:
  - bloquear despliegues nuevos
  - restaurar backup o aplicar rollback SQL manual validado
  - dejar constancia en el changelog operativo

## Rotacion de claves

- Rotar periodicamente:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `TURNSTILE_SECRET_KEY`
  - `RESEND_API_KEY`
- Tras cada rotacion:
  - actualizar Vercel
  - actualizar staging si procede
  - comprobar `GET /api/health`

## Monitorizacion minima

- Uptime check contra `GET /api/health`
- Alertas de build fallido en Vercel
- Revisión de logs de:
  - auth
  - route handlers de billing
  - webhooks Stripe
  - errores de Supabase

## Smoke manual sugerido

- Registro valido
- Registro bloqueado por validacion/captcha cuando proceda
- Login correcto e incorrecto
- Password reset
- Validacion admin
- Publicacion de turno
- Flujo completo de exchange
- Descarga de PDF normal y oficial
- Billing page
- Checkout/portal/webhook cuando billing se active
