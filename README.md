# ShiftSwap

ShiftSwap es una aplicacion web interna para intercambio de turnos entre empleados. El producto mezcla logica de workforce scheduling con un flujo tipo marketplace: una persona publica un turno, otra propone un acuerdo, la parte publicadora acepta o rechaza, y el expediente se formaliza dentro de la app.

## Estado del proyecto

- Fase actual: Fase 5, testing con usuarios y preparacion real de piloto
- Estado tecnico: `npm run typecheck`, `npm run lint`, `npm run build` y `npm run test:smoke` pasan en local con el corte 2026-06-02
- Estado funcional: flujo v2 de propuestas activo, calendario laboral operativo y billing foundation lista para activacion

## Que incluye hoy

- Auth con Supabase, validacion manual y reset de contrasena
- Registro endurecido con rate limiting y Turnstile opcional
- Tablon de turnos, detalle, filtros y cancelacion
- Flujo v2 de propuestas:
  - proponer `hours_bank` o `shift_exchange`
  - aceptar o rechazar propuestas desde `Mis turnos`
  - expediente formal creado al aceptar
- Chat en tiempo real con fallback por polling
- Firma digital en perfil y firma del solicitante dentro del expediente
- Aprobacion o rechazo departamental
- PDFs del expediente:
  - `/api/exchanges/[id]/pdf`
  - `/api/exchanges/[id]/official-pdf`
- Organizacion real:
  - empresa -> area/taller -> departamento operativo -> puesto
  - cambios de departamento y puesto con cola admin
- Calendario laboral:
  - tipos `3t5` y `jornada_normal`
  - grupos de rotacion
  - vacaciones
  - validacion de dias laborables al publicar/proponer
- Navegacion smartphone-first con bottom nav
- Billing foundation:
  - `/billing`
  - checkout, portal y webhook de Stripe
  - gate comercial centralizado
- Base automatizada de smoke con Playwright para health, auth y navegacion clave

## Stack

- Frontend: Next.js 16 App Router + TypeScript
- UI: Tailwind CSS + shadcn/ui + Radix UI
- Backend/BaaS: Supabase Auth + Postgres + Realtime + Storage
- PDF: `@react-pdf/renderer`
- Deploy: Vercel + Supabase Cloud
- Smoke automation: Playwright

## Inicio rapido

```bash
npm install
cp .env.example .env.local
npm run supabase:start
npm run supabase:status
npm run dev
```

Completa `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` con los valores que muestra `npm run supabase:status`.
La configuracion local del repo espera Supabase en `http://127.0.0.1:56321` y Postgres en `127.0.0.1:56322`.

Para staging, piloto y calendario laboral real, la base debe tener aplicadas las migraciones hasta la ultima de `supabase/migrations/`. A 2026-06-02 la ultima es `20260602103814_lock_internal_billing_and_rate_limit_tables.sql`.
Para aplicar a un proyecto remoto/staging, usa `npx supabase db push` con el proyecto correcto enlazado.

Para preparar usuarios E2E locales, rellena las variables `E2E_*` en `.env.local` y ejecuta primero el dry-run:

```bash
npm run supabase:setup:e2e-auth
npm run supabase:setup:e2e-auth:commit
```

El primer comando es `ROLLBACK` por defecto y no persiste cambios. El segundo exige Supabase local (`NEXT_PUBLIC_SUPABASE_URL` en localhost/127.0.0.1) y crea o repara Auth + `user_profiles`.

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME=ShiftSwap

BILLING_ENABLED=false
BILLING_MODE=user
BILLING_ENFORCEMENT=off
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_USER_MONTHLY_PRICE_ID=

NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

RESEND_API_KEY=
RESEND_FROM_EMAIL=

E2E_BASE_URL=
E2E_PORT=3001
E2E_START_SERVER=
E2E_MEMBER_EMAIL=
E2E_MEMBER_PASSWORD=
E2E_DEPARTMENT_ADMIN_EMAIL=
E2E_DEPARTMENT_ADMIN_PASSWORD=
E2E_HR_ADMIN_EMAIL=
E2E_HR_ADMIN_PASSWORD=
E2E_ADMIN_EMAIL=
E2E_ADMIN_PASSWORD=
E2E_SUPER_ADMIN_EMAIL=
E2E_SUPER_ADMIN_PASSWORD=
E2E_UNRELATED_EMAIL=
E2E_UNRELATED_PASSWORD=
E2E_EXCHANGE_ID=
```

## Comandos utiles

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run test:smoke
npm run supabase:start
npm run supabase:status
npm run supabase:setup:e2e-auth
npm run supabase:setup:e2e-auth:commit
npm run supabase:reset
npx supabase migration up --local
npx supabase db push
```

## Flujo principal vigente

1. Un empleado se registra y queda `pending` para validacion.
2. Un admin valida la cuenta.
3. El empleado publica un turno y elige modalidades aceptadas.
4. Otra persona propone `hours_bank` o `shift_exchange`.
5. La parte publicadora acepta o rechaza.
6. Al aceptar:
   - la propuesta pasa a `accepted`
   - el turno pasa a `negotiating`
   - se crea el expediente
   - la firma del publicador queda implicita
7. La parte solicitante firma el expediente.
8. El intercambio pasa a `pending_validation`.
9. El departamento aprueba o rechaza.
10. Los PDFs se generan como salida del expediente, no como centro del flujo.

## Documentacion principal

- `CLAUDE.md`: brief maestro y fuente de verdad del proyecto
- `MEMORY.md`: estado vivo, decisiones y siguientes pasos
- `docs/ROADMAP.md`: roadmap real del producto
- `docs/API.md`: superficie tecnica vigente
- `docs/OPERATIONS.md`: staging, despliegue, observabilidad y rollback
- `docs/SMOKE_CHECKLIST.md`: checklist manual y alcance del smoke automatizado
- `docs/SECURITY_BASELINE.md`: gates de seguridad antes de piloto
- `docs/BOXOPS_TRANSFER_AUDIT.md`: aprendizajes de BoxOps aplicables a ShiftSwap

## Datos de prueba organizativos

- `supabase/seeds/01_demo_data.sql`: base demo
- `supabase/seeds/02_arcelor_organization.sql`: jerarquia operativa de Arcelor para testing

## Notas

- El repo prioriza Server Components por defecto.
- En Next.js 16, `params` y `searchParams` son `Promise<...>`.
- `src/lib/billing.ts` es la fuente de verdad del acceso comercial.
- `src/lib/calendar.ts` y `src/lib/calendar-data.ts` son la fuente de verdad del calendario laboral.
- En Windows + OneDrive puede aparecer un `EPERM` intermitente en `.next`; limpiar la carpeta y relanzar el build suele resolverlo.

## Licencia

Privado. Todos los derechos reservados.
