import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarRange, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CalendarView } from "@/app/(dashboard)/calendar/calendar-view";
import { getUserCalendar } from "@/lib/calendar-data";
import { getMonthRange, todayISO } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const { month } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Parse month from searchParams or default to current
  const today = todayISO();
  let year: number;
  let monthNum: number;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    [year, monthNum] = month.split("-").map(Number);
  } else {
    const d = new Date();
    year = d.getFullYear();
    monthNum = d.getMonth() + 1;
  }

  const { start, end } = getMonthRange(year, monthNum);
  const calendarDays = await getUserCalendar(authUser.id, start, end);

  const monthLabel = new Date(year, monthNum - 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  // Navigation months
  const prevDate = new Date(year, monthNum - 2);
  const nextDate = new Date(year, monthNum);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Calendario"
        description="Tu horario mensual con turnos, descansos y vacaciones."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/calendar/vacations">
              <Palmtree className="mr-2 size-4" />
              Vacaciones
            </Link>
          </Button>
        }
      />

      {calendarDays ? (
        <CalendarView
          days={calendarDays}
          monthLabel={monthLabel}
          today={today}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
          year={year}
          month={monthNum}
        />
      ) : (
        <EmptyState
          icon={<CalendarRange className="size-6" />}
          title="Calendario no configurado"
          description="Tu area o departamento aun no tiene un tipo de jornada asignado. Cuando un administrador lo configure, aqui veras tu horario mensual."
        />
      )}
    </div>
  );
}
