"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHIFT_TYPE_LABELS } from "@/lib/constants";
import { FORM_CONTROL_CLASSNAME, PANEL_CLASSNAME, cn } from "@/lib/utils";
import type { ShiftType } from "@/types";

interface Department {
  id: string;
  name: string;
}

interface ShiftFiltersProps {
  departments: Department[];
  showDepartmentFilter?: boolean;
  scopeLabel?: string | null;
}

export function ShiftFilters({
  departments,
  showDepartmentFilter = true,
  scopeLabel = null,
}: ShiftFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    const form = formRef.current;
    if (!form) return;

    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (value && typeof value === "string") params.set(key, value);
    }
    router.push(params.toString() ? `/shifts?${params.toString()}` : "/shifts");
  }

  const hasFilters =
    (showDepartmentFilter && searchParams.has("department_id")) ||
    searchParams.has("shift_type") ||
    searchParams.has("from") ||
    searchParams.has("to") ||
    searchParams.get("include_mine") === "1";

  return (
    <form
      key={searchParams.toString()}
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={cn(PANEL_CLASSNAME, "space-y-4 p-5")}
    >
      {searchParams.get("include_mine") === "1" && (
        <input type="hidden" name="include_mine" value="1" />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <SlidersHorizontal className="size-4 text-primary" />
            Filtra los turnos
          </div>
          <p className="text-sm text-muted-foreground">
            {showDepartmentFilter
              ? "Ajusta departamento operativo, tipo o rango de fechas para comparar mas rapido."
              : scopeLabel
                ? `Tu tablon ya esta limitado a ${scopeLabel}. Solo necesitas ajustar tipo o fechas si quieres afinar la busqueda.`
                : "Tu tablon ya esta limitado a tu departamento. Ajusta solo tipo o fechas si quieres afinar la busqueda."}
          </p>
        </div>
        {hasFilters && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/shifts">Limpiar filtros</Link>
          </Button>
        )}
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-2",
          showDepartmentFilter ? "xl:grid-cols-5" : "xl:grid-cols-4"
        )}
      >
        {showDepartmentFilter ? (
          <div className="space-y-2">
            <label
              htmlFor="filter-department"
              className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Departamento
            </label>
            <select
              id="filter-department"
              name="department_id"
              defaultValue={searchParams.get("department_id") ?? ""}
              onChange={submit}
              className={FORM_CONTROL_CLASSNAME}
            >
              <option value="">Todos</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="col-span-2 space-y-2 xl:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Ambito visible
            </label>
            <div
              className={cn(
                FORM_CONTROL_CLASSNAME,
                "flex min-h-10 items-center bg-secondary/45 text-foreground"
              )}
            >
              {scopeLabel ?? "Tu departamento"}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="filter-type"
            className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Tipo
          </label>
          <select
            id="filter-type"
            name="shift_type"
            defaultValue={searchParams.get("shift_type") ?? ""}
            onChange={submit}
            className={FORM_CONTROL_CLASSNAME}
          >
            <option value="">Todos</option>
            {(Object.entries(SHIFT_TYPE_LABELS) as [ShiftType, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="filter-from"
            className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Desde
          </label>
          <input
            id="filter-from"
            type="date"
            name="from"
            defaultValue={searchParams.get("from") ?? ""}
            className={FORM_CONTROL_CLASSNAME}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="filter-to"
            className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Hasta
          </label>
          <input
            id="filter-to"
            type="date"
            name="to"
            defaultValue={searchParams.get("to") ?? ""}
            className={FORM_CONTROL_CLASSNAME}
          />
        </div>

        <div className="col-span-2 flex items-end xl:col-span-1">
          <Button type="submit" variant="outline" className="w-full">
            Aplicar filtros
          </Button>
        </div>
      </div>
    </form>
  );
}
