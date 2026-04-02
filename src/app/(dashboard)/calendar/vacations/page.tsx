import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn, formatShortDate, PANEL_CLASSNAME } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { VacationForm } from "@/app/(dashboard)/calendar/vacations/vacation-form";
import { DeleteVacationButton } from "@/app/(dashboard)/calendar/vacations/delete-vacation-button";

export default async function VacationsPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data: vacations } = await admin
    .from("vacations")
    .select("id, start_date, end_date, notes")
    .eq("user_id", authUser.id)
    .order("start_date", { ascending: false });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vacaciones"
        description="Registra tus periodos de vacaciones para que se reflejen en el calendario."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/calendar">
              <ArrowLeft className="mr-2 size-4" />
              Calendario
            </Link>
          </Button>
        }
      />

      {/* Form */}
      <div className={cn(PANEL_CLASSNAME, "p-5 sm:p-6")}>
        <h2 className="mb-4 text-base font-semibold text-foreground">
          Registrar vacaciones
        </h2>
        <VacationForm />
      </div>

      {/* List */}
      {vacations && vacations.length > 0 ? (
        <div className={cn(PANEL_CLASSNAME, "divide-y divide-border/60 overflow-hidden")}>
          <div className="px-5 py-3 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">
              Tus vacaciones registradas
            </h2>
          </div>
          {vacations.map((v) => {
            const isFuture = v.start_date >= today;
            return (
              <div
                key={v.id}
                className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatShortDate(v.start_date)} — {formatShortDate(v.end_date)}
                  </p>
                  {v.notes && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {v.notes}
                    </p>
                  )}
                </div>
                {isFuture && (
                  <DeleteVacationButton vacationId={v.id} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Palmtree className="size-6" />}
          title="Sin vacaciones registradas"
          description="Cuando registres un periodo de vacaciones, aparecera aqui y se reflejara en tu calendario."
        />
      )}
    </div>
  );
}
