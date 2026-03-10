"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { SHIFT_TYPE_LABELS } from "@/lib/constants";
import type { ShiftType } from "@/types";

interface Department {
  id: string;
  name: string;
}

interface ShiftFiltersProps {
  departments: Department[];
}

export function ShiftFilters({ departments }: ShiftFiltersProps) {
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
    router.push(`/shifts?${params.toString()}`);
  }

  const hasFilters =
    searchParams.has("department_id") ||
    searchParams.has("shift_type") ||
    searchParams.has("from") ||
    searchParams.has("to");

  return (
    <form
      key={searchParams.toString()}
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-department" className="text-xs font-medium text-muted-foreground">
          Departamento
        </label>
        <select
          id="filter-department"
          name="department_id"
          defaultValue={searchParams.get("department_id") ?? ""}
          onChange={submit}
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none ring-ring/50 transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Todos</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-type" className="text-xs font-medium text-muted-foreground">
          Tipo de turno
        </label>
        <select
          id="filter-type"
          name="shift_type"
          defaultValue={searchParams.get("shift_type") ?? ""}
          onChange={submit}
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none ring-ring/50 transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-from" className="text-xs font-medium text-muted-foreground">
          Desde
        </label>
        <input
          id="filter-from"
          type="date"
          name="from"
          defaultValue={searchParams.get("from") ?? ""}
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none ring-ring/50 transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-to" className="text-xs font-medium text-muted-foreground">
          Hasta
        </label>
        <input
          id="filter-to"
          type="date"
          name="to"
          defaultValue={searchParams.get("to") ?? ""}
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none ring-ring/50 transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <button
        type="submit"
        className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm font-medium transition-colors hover:bg-muted"
      >
        Filtrar
      </button>

      {hasFilters && (
        <Link
          href="/shifts"
          className="h-9 flex items-center px-3 rounded-lg text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Limpiar
        </Link>
      )}
    </form>
  );
}
