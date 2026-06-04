"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { USER_ROLE_LABELS } from "@/lib/user-roles";
import { FORM_CONTROL_CLASSNAME, PANEL_CLASSNAME, cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface NamedEntity {
  id: string;
  name: string;
}

interface UserFiltersProps {
  companies: NamedEntity[];
  departments: NamedEntity[];
}

const FILTERABLE_ROLES: UserRole[] = [
  "member",
  "department_admin",
  "hr_admin",
  "super_admin",
];

export function UserFilters({ companies, departments }: UserFiltersProps) {
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
    router.push(
      params.toString() ? `/admin/users?${params.toString()}` : "/admin/users"
    );
  }

  const hasFilters =
    searchParams.has("company_id") ||
    searchParams.has("department_id") ||
    searchParams.has("role") ||
    searchParams.has("q");

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4 text-primary" />
          Filtra usuarios
        </div>
        {hasFilters && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/users">Limpiar filtros</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-2 sm:col-span-2 xl:col-span-1">
          <label
            htmlFor="filter-q"
            className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Nombre
          </label>
          <input
            id="filter-q"
            type="text"
            name="q"
            placeholder="Buscar..."
            defaultValue={searchParams.get("q") ?? ""}
            className={FORM_CONTROL_CLASSNAME}
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="filter-company"
            className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Empresa
          </label>
          <select
            id="filter-company"
            name="company_id"
            defaultValue={searchParams.get("company_id") ?? ""}
            onChange={submit}
            className={FORM_CONTROL_CLASSNAME}
          >
            <option value="">Todas</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

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

        <div className="space-y-2">
          <label
            htmlFor="filter-role"
            className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Rol
          </label>
          <select
            id="filter-role"
            name="role"
            defaultValue={searchParams.get("role") ?? ""}
            onChange={submit}
            className={FORM_CONTROL_CLASSNAME}
          >
            <option value="">Todos</option>
            {FILTERABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {USER_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end sm:col-span-2 xl:col-span-1">
          <Button type="submit" variant="outline" className="w-full">
            Buscar
          </Button>
        </div>
      </div>
    </form>
  );
}
