"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SCHEDULE_TYPE_LABELS } from "@/lib/constants";
import { FORM_CONTROL_CLASSNAME, PANEL_CLASSNAME, cn } from "@/lib/utils";
import type { ScheduleTypeCode } from "@/types";

interface ScheduleConfigFiltersProps {
  filteredAreaCount: number;
  filteredRotationUserCount: number;
  totalAreaCount: number;
  totalRotationUserCount: number;
}

export function ScheduleConfigFilters({
  filteredAreaCount,
  filteredRotationUserCount,
  totalAreaCount,
  totalRotationUserCount,
}: ScheduleConfigFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    const form = formRef.current;
    if (!form) return;

    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (typeof value === "string") {
        const nextValue = value.trim();
        if (nextValue) {
          params.set(key, nextValue);
        }
      }
    }

    router.push(
      params.toString()
        ? `/admin/schedule-config?${params.toString()}`
        : "/admin/schedule-config"
    );
  }

  function clearSearch() {
    const form = formRef.current;
    if (!form) return;

    const searchInput = form.elements.namedItem("q") as HTMLInputElement | null;
    if (searchInput) {
      searchInput.value = "";
    }

    submit();
  }

  const hasFilters = searchParams.has("q") || searchParams.has("schedule_type");
  const hasSearch = Boolean(searchParams.get("q"));

  return (
    <form
      className={cn(PANEL_CLASSNAME, "space-y-4 p-5")}
      key={searchParams.toString()}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      ref={formRef}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <SlidersHorizontal className="size-4 text-primary" />
            Filtra calendarios
          </div>
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? `${filteredAreaCount}/${totalAreaCount} areas y ${filteredRotationUserCount}/${totalRotationUserCount} empleados visibles.`
              : "Busca por area, empleado, departamento, grupo o tipo de jornada."}
          </p>
        </div>
        {hasFilters && (
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/schedule-config">Limpiar filtros</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <label
            className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            htmlFor="schedule-filter-q"
          >
            Buscar
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              autoComplete="off"
              className={cn(
                FORM_CONTROL_CLASSNAME,
                hasSearch ? "pl-10 pr-11" : "pl-10"
              )}
              defaultValue={searchParams.get("q") ?? ""}
              id="schedule-filter-q"
              name="q"
              placeholder="Area, empleado, departamento o grupo"
              type="search"
            />
            {hasSearch ? (
              <button
                aria-label="Limpiar busqueda"
                className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/10"
                onClick={clearSearch}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <label
            className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            htmlFor="schedule-filter-type"
          >
            Tipo
          </label>
          <select
            className={FORM_CONTROL_CLASSNAME}
            defaultValue={searchParams.get("schedule_type") ?? ""}
            id="schedule-filter-type"
            name="schedule_type"
            onChange={submit}
          >
            <option value="">Todos</option>
            {(Object.entries(SCHEDULE_TYPE_LABELS) as [
              ScheduleTypeCode,
              string,
            ][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="unconfigured">Sin configurar</option>
          </select>
        </div>

        <div className="col-span-2 flex items-end lg:col-span-1">
          <Button className="w-full" type="submit" variant="outline">
            Aplicar filtros
          </Button>
        </div>
      </div>
    </form>
  );
}
