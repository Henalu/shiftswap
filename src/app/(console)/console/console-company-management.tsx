"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deletePlatformCompanyAction,
  updatePlatformCompanyAction,
} from "@/lib/platform-console-actions";

export interface CompanyManagementRow {
  accentColor: string | null;
  billingState: string;
  createdAtLabel: string;
  departmentCount: number;
  id: string;
  name: string;
  pendingUserCount: number;
  slug: string;
  userCount: number;
}

function ConfirmCompanyDeleteForm({
  children,
  company,
}: {
  children: ReactNode;
  company: CompanyManagementRow;
}) {
  return (
    <form
      action={deletePlatformCompanyAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Eliminar "${company.name}"? Se borrara tambien su catalogo vacio de areas, departamentos y puestos. Esta accion no se puede deshacer.`
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input name="companyId" type="hidden" value={company.id} />
      <input name="returnTo" type="hidden" value="/console" />
      {children}
    </form>
  );
}

export function ManagedCompaniesTable({
  canManage,
  companies,
}: {
  canManage: boolean;
  companies: CompanyManagementRow[];
}) {
  if (companies.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/80 px-3 py-6 text-center text-sm text-muted-foreground">
        Sin empresas todavia.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="border-b border-border/70 bg-secondary/35 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Empresa</th>
            <th className="px-4 py-3 font-semibold">Usuarios</th>
            <th className="px-4 py-3 font-semibold">Pendientes</th>
            <th className="px-4 py-3 font-semibold">Departamentos</th>
            <th className="px-4 py-3 font-semibold">Color</th>
            <th className="px-4 py-3 font-semibold">Billing</th>
            <th className="px-4 py-3 font-semibold">Alta</th>
            {canManage ? (
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {companies.map((company) => (
            <ManagedCompanyRow
              canManage={canManage}
              company={company}
              key={company.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManagedCompanyRow({
  canManage,
  company,
}: {
  canManage: boolean;
  company: CompanyManagementRow;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const columnCount = canManage ? 8 : 7;

  if (isEditing) {
    return (
      <tr>
        <td className="px-4 py-4" colSpan={columnCount}>
          <form action={updatePlatformCompanyAction} className="grid gap-4">
            <input name="companyId" type="hidden" value={company.id} />
            <input name="returnTo" type="hidden" value="/console" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_auto] md:items-end">
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium"
                  htmlFor={`company-name-${company.id}`}
                >
                  Nombre
                </label>
                <Input
                  defaultValue={company.name}
                  id={`company-name-${company.id}`}
                  maxLength={120}
                  name="companyName"
                  required
                />
              </div>
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium"
                  htmlFor={`company-slug-${company.id}`}
                >
                  Slug
                </label>
                <Input
                  defaultValue={company.slug}
                  id={`company-slug-${company.id}`}
                  maxLength={64}
                  name="companySlug"
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  required
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" type="submit">
                  <Check className="size-4" />
                  Guardar
                </Button>
                <Button
                  onClick={() => setIsEditing(false)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <X className="size-4" />
                  Cancelar
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Usuarios, departamentos, color y billing se mantienen igual.
            </p>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium">{company.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{company.slug}</p>
      </td>
      <td className="px-4 py-3">{company.userCount}</td>
      <td className="px-4 py-3">{company.pendingUserCount}</td>
      <td className="px-4 py-3">{company.departmentCount}</td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-2">
          <span
            className="size-4 rounded-full border border-border"
            style={
              company.accentColor
                ? { backgroundColor: company.accentColor }
                : undefined
            }
          />
          <span className="font-mono text-xs text-muted-foreground">
            {company.accentColor ?? "por defecto"}
          </span>
        </span>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline">{company.billingState}</Badge>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {company.createdAtLabel}
      </td>
      {canManage ? (
        <td className="px-4 py-3">
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setIsEditing(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Pencil className="size-4" />
              Editar
            </Button>
            <ConfirmCompanyDeleteForm company={company}>
              <Button size="sm" type="submit" variant="destructive">
                <Trash2 className="size-4" />
                Eliminar
              </Button>
            </ConfirmCompanyDeleteForm>
          </div>
        </td>
      ) : null}
    </tr>
  );
}
