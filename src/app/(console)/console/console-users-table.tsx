"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SearchX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPlatformUserPasswordAction } from "@/lib/platform-console-actions";
import { USER_ROLE_LABELS } from "@/lib/user-roles";
import { cn, FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import type { UserRole, ValidationStatus } from "@/types";

export interface ConsoleUserListItem {
  id: string;
  email: string;
  fullName: string;
  companyName: string;
  departmentName: string;
  jobPositionName: string;
  role: UserRole;
  validationStatus: ValidationStatus;
}

interface ConsoleUsersTableProps {
  canOperateUsers: boolean;
  users: ConsoleUserListItem[];
}

const PAGE_SIZE = 15;

const VALIDATION_STATUS_LABELS: Record<ValidationStatus, string> = {
  approved: "Aprobado",
  pending: "Pendiente",
  rejected: "Rechazado",
};

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getUserSearchValue(user: ConsoleUserListItem) {
  return normalizeSearchValue(
    [
      user.fullName,
      user.email,
      user.companyName,
      user.departmentName,
      user.jobPositionName,
      USER_ROLE_LABELS[user.role],
      user.role,
      VALIDATION_STATUS_LABELS[user.validationStatus],
      user.validationStatus,
    ].join(" ")
  );
}

function getUniqueSortedValues(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );
}

export function ConsoleUsersTable({
  canOperateUsers,
  users,
}: ConsoleUsersTableProps) {
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const normalizedQuery = normalizeSearchValue(query.trim());
  const hasFilters =
    normalizedQuery.length > 0 || companyFilter || roleFilter || statusFilter;

  const companyOptions = useMemo(
    () => getUniqueSortedValues(users.map((user) => user.companyName)),
    [users]
  );
  const roleOptions = useMemo(
    () =>
      Array.from(new Set(users.map((user) => user.role))).sort((a, b) =>
        USER_ROLE_LABELS[a].localeCompare(USER_ROLE_LABELS[b], "es", {
          sensitivity: "base",
        })
      ),
    [users]
  );
  const statusOptions = useMemo(
    () =>
      Array.from(new Set(users.map((user) => user.validationStatus))).sort(
        (a, b) =>
          VALIDATION_STATUS_LABELS[a].localeCompare(
            VALIDATION_STATUS_LABELS[b],
            "es",
            { sensitivity: "base" }
          )
      ),
    [users]
  );

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (companyFilter && user.companyName !== companyFilter) return false;
        if (roleFilter && user.role !== roleFilter) return false;
        if (statusFilter && user.validationStatus !== statusFilter) return false;
        if (!normalizedQuery) return true;

        return getUserSearchValue(user).includes(normalizedQuery);
      }),
    [companyFilter, normalizedQuery, roleFilter, statusFilter, users]
  );

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function resetToFirstPage() {
    setPage(1);
  }

  function clearFilters() {
    setQuery("");
    setCompanyFilter("");
    setRoleFilter("");
    setStatusFilter("");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(240px,1.4fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_auto] lg:items-end">
          <div className="space-y-2">
            <label
              className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              htmlFor="console-user-search"
            >
              Buscar usuario
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                autoComplete="off"
                className={cn(FORM_CONTROL_CLASSNAME, "pl-10 pr-10")}
                id="console-user-search"
                onChange={(event) => {
                  setQuery(event.target.value);
                  resetToFirstPage();
                }}
                placeholder="Nombre, email, empresa, departamento o puesto..."
                type="search"
                value={query}
              />
              {normalizedQuery ? (
                <button
                  aria-label="Limpiar busqueda de usuarios"
                  className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/10"
                  onClick={() => {
                    setQuery("");
                    resetToFirstPage();
                  }}
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
              htmlFor="console-user-company"
            >
              Empresa
            </label>
            <select
              className={FORM_CONTROL_CLASSNAME}
              id="console-user-company"
              onChange={(event) => {
                setCompanyFilter(event.target.value);
                resetToFirstPage();
              }}
              value={companyFilter}
            >
              <option value="">Todas</option>
              {companyOptions.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              htmlFor="console-user-role"
            >
              Rol
            </label>
            <select
              className={FORM_CONTROL_CLASSNAME}
              id="console-user-role"
              onChange={(event) => {
                setRoleFilter(event.target.value);
                resetToFirstPage();
              }}
              value={roleFilter}
            >
              <option value="">Todos</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {USER_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              htmlFor="console-user-status"
            >
              Estado
            </label>
            <select
              className={FORM_CONTROL_CLASSNAME}
              id="console-user-status"
              onChange={(event) => {
                setStatusFilter(event.target.value);
                resetToFirstPage();
              }}
              value={statusFilter}
            >
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {VALIDATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <Button
            className="w-full lg:w-auto"
            disabled={!hasFilters}
            onClick={clearFilters}
            type="button"
            variant="outline"
          >
            <X className="size-4" />
            Limpiar
          </Button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {filteredUsers.length} de {users.length} usuarios visibles
        </p>
      </div>

      <div className="grid gap-3 md:hidden">
        {visibleUsers.length > 0 ? (
          visibleUsers.map((user) => (
            <article
              className="rounded-2xl border border-border/70 bg-background/90 p-4"
              key={user.id}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {user.fullName}
                  </h3>
                  <p className="truncate text-sm text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <Badge className="shrink-0" variant="outline">
                  {VALIDATION_STATUS_LABELS[user.validationStatus]}
                </Badge>
              </div>

              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Empresa
                  </dt>
                  <dd className="mt-1 text-foreground">{user.companyName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Departamento
                  </dt>
                  <dd className="mt-1 text-foreground">{user.departmentName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Puesto
                  </dt>
                  <dd className="mt-1 text-foreground">{user.jobPositionName}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Rol
                  </dt>
                  <dd>
                    <Badge variant="outline">{USER_ROLE_LABELS[user.role]}</Badge>
                  </dd>
                </div>
              </dl>

              <div className="mt-4 border-t border-border/60 pt-4">
                {canOperateUsers ? (
                  <details>
                    <summary className="min-h-11 cursor-pointer rounded-xl text-sm font-medium text-primary underline-offset-4 hover:underline">
                      Resetear acceso
                    </summary>
                    <form
                      action={resetPlatformUserPasswordAction}
                      className="mt-3 grid gap-2"
                    >
                      <input name="userId" type="hidden" value={user.id} />
                      <Input
                        autoComplete="new-password"
                        minLength={8}
                        name="temporaryPassword"
                        placeholder="Contrasena temporal"
                        required
                        type="password"
                      />
                      <Input
                        autoComplete="new-password"
                        minLength={8}
                        name="confirmTemporaryPassword"
                        placeholder="Confirmar"
                        required
                        type="password"
                      />
                      <Button size="sm" type="submit" variant="outline">
                        Forzar cambio
                      </Button>
                    </form>
                  </details>
                ) : (
                  <span className="text-sm text-muted-foreground">Lectura</span>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border/80 bg-secondary/30 px-4 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary">
              <SearchX aria-hidden="true" className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Sin usuarios con esos filtros
              </p>
              <p className="text-sm text-muted-foreground">
                Prueba con otro nombre, email, empresa, rol o estado.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-border/70 md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-border/70 bg-secondary/35 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Usuario</th>
              <th className="px-4 py-3 font-semibold">Empresa</th>
              <th className="px-4 py-3 font-semibold">Departamento</th>
              <th className="px-4 py-3 font-semibold">Puesto</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acceso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {visibleUsers.length > 0 ? (
              visibleUsers.map((user) => (
                <tr key={user.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">{user.companyName}</td>
                  <td className="px-4 py-3">{user.departmentName}</td>
                  <td className="px-4 py-3">{user.jobPositionName}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{USER_ROLE_LABELS[user.role]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      {VALIDATION_STATUS_LABELS[user.validationStatus]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canOperateUsers ? (
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline">
                          Resetear
                        </summary>
                        <form
                          action={resetPlatformUserPasswordAction}
                          className="mt-3 grid w-full max-w-72 gap-2"
                        >
                          <input name="userId" type="hidden" value={user.id} />
                          <Input
                            autoComplete="new-password"
                            minLength={8}
                            name="temporaryPassword"
                            placeholder="Contrasena temporal"
                            required
                            type="password"
                          />
                          <Input
                            autoComplete="new-password"
                            minLength={8}
                            name="confirmTemporaryPassword"
                            placeholder="Confirmar"
                            required
                            type="password"
                          />
                          <Button size="sm" type="submit" variant="outline">
                            Forzar cambio
                          </Button>
                        </form>
                      </details>
                    ) : (
                      <span className="text-muted-foreground">Lectura</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-5" colSpan={7}>
                  <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border/80 bg-secondary/30 px-4 py-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary">
                      <SearchX aria-hidden="true" className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        Sin usuarios con esos filtros
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Prueba con otro nombre, email, empresa, rol o estado.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Pagina {currentPage} de {pageCount} · maximo {PAGE_SIZE} usuarios por
          pagina
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            size="sm"
            type="button"
            variant="outline"
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <Button
            disabled={currentPage >= pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            size="sm"
            type="button"
            variant="outline"
          >
            Siguiente
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
