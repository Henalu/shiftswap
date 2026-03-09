# ShiftSwap

Plataforma interna de intercambio de turnos entre empleados. Funciona como un marketplace donde los empleados publican turnos que quieren intercambiar y otros pueden aceptarlos.

## Stack

- **Frontend:** Next.js 14+ (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **PDF:** jsPDF / @react-pdf/renderer
- **Deploy:** Vercel + Supabase Cloud

## Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env.local

# 3. Configurar Supabase (añadir keys en .env.local)

# 4. Ejecutar migraciones
npx supabase db push

# 5. Iniciar servidor de desarrollo
npm run dev
```

## Estructura del proyecto

```
src/
├── app/              # Páginas (Next.js App Router)
│   ├── (auth)/       # Login, registro
│   ├── (dashboard)/  # Turnos, chat, perfil, intercambios
│   └── api/          # API routes
├── components/       # Componentes React
├── lib/              # Utilidades y config Supabase
├── hooks/            # Custom hooks
├── types/            # Tipos TypeScript
└── styles/           # Estilos globales

supabase/
└── migrations/       # SQL migrations

docs/                 # Documentación adicional
```

## Fases de desarrollo

1. **Prototipo** — Login, CRUD turnos, lista, botón "me interesa"
2. **Matching** — Filtros, notificaciones, estados
3. **Chat** — Mensajería en tiempo real
4. **Confirmación** — Flujo de confirmación + PDF
5. **Test con usuarios** — Piloto con grupo real

## Licencia

Privado — Todos los derechos reservados.
