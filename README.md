# ShiftSwap

ShiftSwap es una aplicacion web interna para intercambio de turnos entre empleados. El producto mezcla logica de scheduling/workforce app con interaccion tipo marketplace: una persona publica un turno, otra muestra interes, ambas negocian por chat y, si llegan a acuerdo, completan el expediente formal dentro de la app.

## Estado del proyecto

- Estado actual: base funcional cerrada y lista para despliegue
- Fase actual: Fase 5, testing con usuarios y preparacion para piloto
- Hito actual: workflow nativo de intercambio con aprobacion departamental, acuerdos de compensacion y PDF corporativo

## Que incluye hoy

- Registro y login con Supabase Auth
- Validacion manual de empleados antes de acceder al dashboard
- Publicacion, listado, detalle y gestion de turnos
- Filtros por departamento, tipo de turno y rango de fechas
- Flujo de interes, aceptacion y rechazo de solicitudes
- Chat en tiempo real con fallback por polling
- Workflow formal de intercambio dentro de la app
- Firmas embebidas para ambas partes
- Aprobacion o rechazo por un tercer actor del departamento
- Trazabilidad del expediente con historial de eventos
- Acuerdos de compensacion:
  - bolsa de horas
  - intercambio de turno futuro
- Base de ledger para deudas de bolsa de horas
- PDF corporativo generado por el sistema
- Centro de notificaciones con badge real, dedupe y navegacion contextual
- Perfil consolidado con avatar upload
- Panel admin para validaciones, roles y aprobaciones
- Sistema visual actualizado para un producto interno moderno, claro y muy legible

## Stack

- Frontend: Next.js 16 App Router + TypeScript
- UI: Tailwind CSS + shadcn/ui + Radix UI
- Backend/BaaS: Supabase (PostgreSQL, Auth, Realtime, Storage)
- PDF: `@react-pdf/renderer`
- Deploy: Vercel + Supabase Cloud

## Direccion UX/UI

La app no se comporta como una web de marketing. La direccion actual prioriza:

- claridad funcional
- legibilidad
- rapidez de escaneo
- estados muy visibles
- acciones obvias
- minima decoracion superflua

Referencias mentales activas:

- Stripe por sistema visual y limpieza
- Deputy por sensacion de producto workforce interno

La guia de diseno persistida para futuras sesiones vive en `.impeccable.md`.

## Inicio rapido

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env.local

# 3. Configurar variables de Supabase en .env.local

# 4. Aplicar migraciones
npx supabase db push

# 5. Arrancar desarrollo
npm run dev
```

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Comandos utiles

```bash
npm run dev
npm run lint
npm run build
npx supabase db push
```

## Estructura del proyecto

```text
src/
  app/
    (auth)/              # login, register, pending-validation
    (dashboard)/         # shifts, chat, exchanges, profile, admin
    api/                 # route handlers (ej. PDF)
  components/
    exchanges/           # workflow progress y patrones del expediente
    layout/              # header, sidebar, notification bell
    shifts/              # shift card, filters, actions
    ui/                  # design system base
  lib/
    supabase/            # clients y middleware helpers
    exchange-workflow.ts # estados, acceso y trazabilidad
    exchange-compensation.ts
    exchange-pdf-document.tsx
    constants.ts         # labels y estilos de estados
    notifications.ts     # create/read/resolve helpers
    notification-utils.ts
    user-roles.ts
    utils.ts
  types/

supabase/
  migrations/
  seeds/
```

## Flujo principal del producto

1. Un empleado se registra y queda en estado pendiente de validacion.
2. Un admin valida la cuenta.
3. El empleado publica un turno o explora turnos disponibles.
4. Otra persona muestra interes.
5. La persona propietaria acepta o rechaza.
6. Si acepta, se crea el exchange y ambas partes pueden negociar por chat.
7. La contraparte confirma el acuerdo.
8. Ambas personas firman la solicitud dentro de la app.
9. La persona interesada define el tipo de compensacion:
   - `hours_bank`
   - `shift_exchange`
10. Si el acuerdo es `hours_bank`, el sistema registra una deuda de 1 turno.
11. Si el acuerdo es `shift_exchange`, el sistema guarda fecha futura y tipo de turno acordado.
12. La solicitud pasa a revision del departamento.
13. El departamento aprueba o rechaza desde la app.
14. El PDF corporativo se genera como salida del expediente.

## Documentacion adicional

- `CLAUDE.md`: brief maestro del proyecto para arquitectura, workflow y patrones
- `AGENTS.md`: adaptacion minima para Codex
- `MEMORY.md`: estado vivo del proyecto y decisiones recientes
- `docs/ROADMAP.md`: roadmap actualizado
- `docs/API.md`: superficie tecnica real de rutas, paginas y server actions

## Notas

- El repo prioriza Server Components por defecto.
- `params` y `searchParams` en Next.js 16 son `Promise<...>`.
- Para produccion, Supabase debe tener aplicadas las migraciones hasta `00019`.
- En Windows + OneDrive puede aparecer un `EPERM` intermitente en `next build` por locks en `.next`; limpiar la carpeta y reintentar suele resolverlo.

## Licencia

Privado. Todos los derechos reservados.
