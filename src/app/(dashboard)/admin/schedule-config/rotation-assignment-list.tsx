"use client";

import { useMemo, useState } from "react";
import { Search, SearchX, X } from "lucide-react";
import { UserRotationForm } from "@/app/(dashboard)/admin/schedule-config/user-rotation-form";
import { cn, FORM_CONTROL_CLASSNAME } from "@/lib/utils";

interface RotationGroupOption {
  id: string;
  code: string;
  label: string;
}

interface RotationAssignmentUser {
  id: string;
  full_name: string;
  areaName: string;
  departmentName: string;
  currentGroup: RotationGroupOption | null;
  currentGroupId: string | null;
}

interface RotationAssignmentListProps {
  rotationGroups: RotationGroupOption[];
  users: RotationAssignmentUser[];
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getUserSearchValue(user: RotationAssignmentUser) {
  return normalizeSearchValue(
    [
      user.full_name,
      user.areaName,
      user.departmentName,
      user.currentGroup?.label,
      user.currentGroup?.code,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function RotationAssignmentList({
  rotationGroups,
  users,
}: RotationAssignmentListProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearchValue(query.trim());
  const hasQuery = normalizedQuery.length > 0;
  const filteredUsers = useMemo(
    () =>
      hasQuery
        ? users.filter((user) =>
            getUserSearchValue(user).includes(normalizedQuery)
          )
        : users,
    [hasQuery, normalizedQuery, users]
  );

  return (
    <>
      <div className="border-b border-border/60 bg-background/45 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2 lg:max-w-md lg:flex-1">
            <label
              className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              htmlFor="rotation-assignment-search"
            >
              Buscar empleado
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                autoComplete="off"
                className={cn(FORM_CONTROL_CLASSNAME, "pl-10 pr-10")}
                id="rotation-assignment-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nombre, area, departamento o grupo..."
                type="search"
                value={query}
              />
              {hasQuery ? (
                <button
                  aria-label="Limpiar busqueda de empleados"
                  className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/10"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              ) : null}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {hasQuery
              ? `${filteredUsers.length}/${users.length} empleados visibles`
              : `${users.length} empleado${users.length !== 1 ? "s" : ""} asignable${users.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {filteredUsers.length > 0 ? (
        <div className="divide-y divide-border/60">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex flex-col gap-3 px-5 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {user.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.areaName} - {user.departmentName}
                </p>
                <p className="text-xs font-medium text-foreground">
                  Grupo actual:{" "}
                  {user.currentGroup?.label ?? "Sin grupo asignado"}
                </p>
              </div>
              <UserRotationForm
                currentGroupId={user.currentGroupId}
                rotationGroups={rotationGroups}
                userId={user.id}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border/80 bg-secondary/30 px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary">
              <SearchX aria-hidden="true" className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Sin empleados con esa busqueda
              </p>
              <p className="text-sm text-muted-foreground">
                Prueba con otro nombre, area, departamento o grupo de rotacion.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
