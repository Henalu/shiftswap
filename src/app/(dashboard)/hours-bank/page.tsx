import { redirect } from "next/navigation";
import { Clock, MessageSquare, WalletCards } from "lucide-react";
import { startConversation } from "@/app/(dashboard)/chat/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatShortDate, formatTimeRange } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { ShiftDebtTransactionStatus } from "@/types";

interface HoursBankDebtRow {
  id: string;
  exchange_id: string;
  creditor_user_id: string;
  units: number;
  status: ShiftDebtTransactionStatus;
  created_at: string;
  creditor:
    | {
        id: string;
        full_name: string;
        email: string;
      }
    | {
        id: string;
        full_name: string;
        email: string;
      }[]
    | null;
  exchange:
    | {
        id: string;
        shift_id: string;
        shift:
          | {
              date: string;
              start_time: string;
              end_time: string;
            }
          | {
              date: string;
              start_time: string;
              end_time: string;
            }[]
          | null;
      }
    | {
        id: string;
        shift_id: string;
        shift:
          | {
              date: string;
              start_time: string;
              end_time: string;
            }
          | {
              date: string;
              start_time: string;
              end_time: string;
            }[]
          | null;
      }[]
    | null;
}

interface HoursBankSummary {
  userId: string;
  fullName: string;
  email: string;
  activeHours: number;
  pendingHours: number;
  latestShiftId: string | null;
  latestDate: string | null;
  latestTimeRange: string | null;
}

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function pluralizeHours(value: number) {
  return `${value} hora${value === 1 ? "" : "s"}`;
}

export default async function HoursBankPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data: debts } = await supabase
    .from("shift_debt_transactions")
    .select(
      `
      id,
      exchange_id,
      creditor_user_id,
      units,
      status,
      created_at,
      creditor:user_profiles!creditor_user_id(id, full_name, email),
      exchange:exchanges!exchange_id(
        id,
        shift_id,
        shift:shifts!shift_id(date, start_time, end_time)
      )
    `,
    )
    .eq("debtor_user_id", authUser.id)
    .in("status", ["pending_approval", "active"])
    .order("created_at", { ascending: false });

  const summaries = new Map<string, HoursBankSummary>();

  for (const debt of ((debts ?? []) as unknown as HoursBankDebtRow[])) {
    const creditor = pickFirst(debt.creditor);
    if (!creditor) continue;

    const exchange = pickFirst(debt.exchange);
    const shift = pickFirst(exchange?.shift);
    const existing = summaries.get(creditor.id) ?? {
      userId: creditor.id,
      fullName: creditor.full_name,
      email: creditor.email,
      activeHours: 0,
      pendingHours: 0,
      latestShiftId: null,
      latestDate: null,
      latestTimeRange: null,
    };

    if (debt.status === "active") {
      existing.activeHours += debt.units;
    } else {
      existing.pendingHours += debt.units;
    }

    if (!existing.latestDate && exchange?.shift_id) {
      existing.latestShiftId = exchange.shift_id;
      existing.latestDate = shift?.date ?? null;
      existing.latestTimeRange = shift
        ? formatTimeRange(shift.start_time, shift.end_time)
        : null;
    }

    summaries.set(creditor.id, existing);
  }

  const rows = [...summaries.values()].sort(
    (a, b) => b.activeHours + b.pendingHours - (a.activeHours + a.pendingHours),
  );
  const totalActiveHours = rows.reduce((total, row) => total + row.activeHours, 0);
  const totalPendingHours = rows.reduce((total, row) => total + row.pendingHours, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compensacion"
        title="Bolsa de horas"
        description="Consulta las horas que debes a otros companeros por cambios aceptados mediante bolsa de horas."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card size="sm">
          <CardContent className="flex items-center justify-between gap-4 pt-1">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Horas confirmadas
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {pluralizeHours(totalActiveHours)}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <WalletCards className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="flex items-center justify-between gap-4 pt-1">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Pendientes de aprobacion
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {pluralizeHours(totalPendingHours)}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700">
              <Clock className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<WalletCards className="size-5" />}
          title="No debes horas ahora mismo"
          description="Cuando aceptes una propuesta de bolsa de horas y quede registrada, aparecera aqui agrupada por persona."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.userId}>
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="truncate text-lg">
                      {row.fullName}
                    </CardTitle>
                    <CardDescription className="truncate">
                      {row.email}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="border-amber-500/15 bg-amber-500/10 text-amber-700">
                      {pluralizeHours(row.activeHours)}
                    </Badge>
                    {row.pendingHours > 0 ? (
                      <Badge variant="outline">
                        {pluralizeHours(row.pendingHours)} pendientes
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  {row.latestDate
                    ? `Ultimo cambio: ${formatShortDate(row.latestDate)}${
                        row.latestTimeRange ? `, ${row.latestTimeRange}` : ""
                      }.`
                    : "Ultimo cambio sin fecha disponible."}
                </p>
                {row.latestShiftId ? (
                  <form action={startConversation}>
                    <input type="hidden" name="shift_id" value={row.latestShiftId} />
                    <input type="hidden" name="other_user_id" value={row.userId} />
                    <Button type="submit" variant="outline" size="sm">
                      <MessageSquare className="size-4" />
                      Abrir chat
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
