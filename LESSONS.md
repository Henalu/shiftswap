# LESSONS.md -- Aprendizajes del proyecto ShiftSwap

Archivo vivo que recoge errores recurrentes, patrones peligrosos y decisiones correctivas
para no repetir los mismos fallos conforme avanza el proyecto.

---

## 1. Redirect circulares entre paginas del dashboard

**Fecha:** 2026-04-01
**Severidad:** critica (bucle infinito, app inutilizable)

### Que paso
`/shifts/page.tsx` redirige a `/profile?setup=1` cuando el perfil no tiene `department_id`.
`/profile/page.tsx` redirige a `/shifts` cuando hay un error de DB cargando el perfil.
Si la query del perfil falla (p.ej. columna nueva sin migracion aplicada), ambas paginas se
rebotan la una a la otra en bucle infinito.

### Regla aprendida
**La pagina de perfil NUNCA debe redirigir a `/shifts` ni a ninguna pagina que pueda
redirigir de vuelta a `/profile`.** El perfil es la "pagina segura" del dashboard: si falla
la carga, mostrar un error en la propia pagina, no redirigir.

### Patron general
Antes de anadir `redirect(X)` en cualquier pagina, comprobar que X no redirige de vuelta
al origen bajo ninguna condicion (error de DB, columna inexistente, perfil incompleto).
El grafo de redirects debe ser un DAG, nunca un ciclo.

### Correccion aplicada
- `/profile/page.tsx`: sustituido `redirect("/shifts")` por un estado de error en pagina.
  Ademas, si la query principal falla, se intenta un fallback sin columnas nuevas.
- `/shifts/page.tsx` y `/shifts/new/page.tsx`: se diferencia query fallida (mostrar error
  en pagina) de department_id ausente (redirect a /profile, que es seguro).
- `/pending-validation/page.tsx`: eliminado `redirect("/profile?setup=1")` cuando no hay
  fila de perfil; se muestra el estado pendiente en la misma pagina.

---

## 2. Columnas nuevas rompen queries existentes si la migracion no se aplica

**Fecha:** 2026-04-01
**Severidad:** alta

### Que paso
Al anadir `signature_url` al SELECT del perfil en fase 3, la query falla si la migracion
00028 no se ha aplicado todavia. Eso desencadeno el redirect circular del punto 1.

### Regla aprendida
Cuando se anade una columna nueva a una query critica (perfil, layout, middleware):
1. Asegurar que la pagina tiene un fallback si la columna no existe.
2. Idealmente, usar un SELECT de la columna nueva por separado (como se hizo con
   `onboarding_completed_at` en el layout).
3. No depender de que "la migracion ya esta" -- el entorno local puede no tenerla.

### Patron defensivo
```typescript
// Bueno: query separada para columnas opcionales
const { data: extras } = await supabase
  .from("user_profiles")
  .select("signature_url, onboarding_completed_at")
  .eq("id", userId)
  .maybeSingle();

// Bueno: fallback si falla la query principal
if (profileError) {
  const { data: fallback } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, phone")
    .eq("id", userId)
    .maybeSingle();
}
```

---

## 3. shadcn/ui genera componentes con dependencias que no estan instaladas

**Fecha:** 2026-04-01
**Severidad:** media (rompe build)

### Que paso
`npx shadcn@latest add checkbox` genero un componente que importa `@base-ui/react/checkbox`,
paquete que no esta en el proyecto. El build fallo inmediatamente.

### Regla aprendida
Despues de ejecutar `npx shadcn add <componente>`:
1. Verificar que todas las importaciones del fichero generado estan en `package.json`.
2. Si la dependencia es nueva y pesada, valorar si un input nativo es suficiente.
3. Para checkboxes simples, un `<input type="checkbox">` con Tailwind es mas seguro.

### Alternativa usada
En el modal de onboarding se uso `<input type="checkbox" className="...">` nativo en vez
del componente de shadcn.

---

## 4. `Promise.all` con Supabase no lanza excepciones pero puede devolver null

**Fecha:** 2026-04-01
**Severidad:** baja

### Que paso
En el layout del dashboard se anadio una query de `onboarding_completed_at` al
`Promise.all`. Las queries de Supabase no rechazan la Promise, sino que devuelven
`{ data: null, error: {...} }`. Eso significa que `Promise.all` nunca falla, pero el
dato puede ser null silenciosamente.

### Regla aprendida
Despues de desestructurar resultados de `Promise.all` con Supabase, siempre manejar
el caso `data === null` explicitamente. No asumir que "si Promise.all resuelve, todo OK".

---

## 5. Next.js 16: `params` y `searchParams` son Promise

**Fecha:** (previo, documentado para referencia)

### Regla
En App Router de Next.js 16, `params` y `searchParams` son `Promise<...>`.
Siempre hacer `const { id } = await params` antes de usarlos.

---

## 6. PDF con @react-pdf/renderer: tipado de Response y fuentes

**Fecha:** (previo, documentado para referencia)

### Reglas
- `renderToBuffer(...)` devuelve un tipo que no satisface el constructor de `Response`.
  Siempre envolver: `new Response(new Uint8Array(pdfBuffer), ...)`.
- Helvetica solo soporta combinaciones basicas de `fontWeight` y `fontStyle`.
  No usar variantes como `Helvetica-BoldItalic` como string en `fontFamily`; en su lugar
  usar `fontWeight: 700` + `fontStyle: "italic"` en el style object.

---

## 7. RLS recursiva en user_profiles (42P17)

**Fecha:** (previo, documentado para referencia)

### Regla
Nunca usar `SELECT FROM user_profiles` dentro de una politica RLS de `user_profiles`.
Usar funciones `SECURITY DEFINER` (`get_user_role`, `get_user_company`,
`get_user_department`) que bypassean RLS internamente.

---

## 8. Column-level GRANTs en PostgreSQL rompen operaciones silenciosamente

**Fecha:** 2026-04-02
**Severidad:** critica (5 bugs simultaneos)

### Que paso
Migration 00016 configuro GRANTs a nivel de columna en `user_profiles`. Migrations posteriores
(00023 para `job_position_id`, 00028 para `signature_url` y `onboarding_completed_at`) anadieron
columnas pero NO actualizaron los GRANTs. Como resultado:
- El guardado de firma fallaba para todos los usuarios (no UPDATE en signature_url)
- El onboarding modal reaparecia siempre (no SELECT en onboarding_completed_at)
- El super admin no podia acceder a modulos admin (layout cascaba)
- Server-side exception en toda la app

### Regla aprendida
**Cuando una migration usa GRANTs a nivel de columna, toda migration posterior que anada
columnas a esa tabla DEBE incluir los GRANTs correspondientes.** Si no, las operaciones
client-side fallan silenciosamente (la query devuelve null sin error visible en Supabase).

### Patron defensivo
Para columnas sensibles, usar `createAdminClient()` (service role) que bypasea tanto
RLS como column-level grants. Para el resto, siempre verificar en la migration:
```sql
-- Si ya existen GRANTs a nivel de columna en la tabla, anadir las nuevas:
GRANT SELECT (nueva_columna) ON public.tabla TO authenticated;
GRANT UPDATE (nueva_columna) ON public.tabla TO authenticated;
```

### Como detectarlo
Si una operacion de Supabase client-side devuelve null pero el admin client funciona,
buscar GRANTs a nivel de columna con:
```sql
SELECT column_name, privilege_type FROM information_schema.column_privileges
WHERE table_name = 'user_profiles' AND grantee = 'authenticated';
```

---

## 9. Ampliar un union type rompe todos los Record<Type, ...> del proyecto

**Fecha:** 2026-04-02
**Severidad:** media (rompe build)

### Que paso
Al anadir `normal_full` y `normal_short` a `ShiftType`, todos los objetos tipados como
`Record<ShiftType, string>` fallaron: `SHIFT_TYPE_LABELS`, `SHIFT_TYPE_STYLES`,
`OFFICIAL_SHIFT_LABELS` en el PDF, y `SHIFT_TYPE_SCHEDULES`.

### Regla aprendida
Al ampliar un union type, buscar todos los `Record<TipoAmpliado, ...>` en el proyecto
y actualizarlos en el mismo cambio. Un grep rapido lo resuelve:
```bash
grep -rn "Record<ShiftType" src/
```

---

## Checklist antes de merge

- [ ] Verificar que no se crean redirects circulares (`grep -r "redirect(" src/app/`)
- [ ] Si se anade columna nueva a una query, confirmar fallback si la migracion falta
- [ ] Build limpio: `npm run build`
- [ ] Si se uso `npx shadcn add`, verificar imports del componente generado
