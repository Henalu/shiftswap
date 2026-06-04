import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarRange, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CalendarView } from "@/app/(dashboard)/calendar/calendar-view";
import { getUserCalendar } from "@/lib/calendar-data";
import { getMonthRange, todayISO } from "@/lib/calendar";
import { expireStaleOpenShifts } from "@/lib/stale-shifts";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("department_id")
    .eq("id", authUser.id)
    .maybeSingle();

  const { data: department } = profile?.department_id
    ? await adminClient
        .from("departments")
        .select("id, name, parent_department_id")
        .eq("id", profile.department_id)
        .maybeSingle()
    : { data: null };

  const { data: parentDepartment } = department?.parent_department_id
    ? await adminClient
        .from("departments")
        .select("name")
        .eq("id", department.parent_department_id)
        .maybeSingle()
    : { data: null };

  const publicationScope = department
    ? {
        areaName: parentDepartment?.name ?? department.name,
        departmentName: department.name,
      }
    : null;

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
  await expireStaleOpenShifts();

  const publicationStart = start > today ? start : today;
  let publicationsQuery = adminClient
    .from("shifts")
    .select("id, date, user_id, department_id")
    .eq("status", "open")
    .is("direct_recipient_id", null)
    .gte("date", publicationStart)
    .lte("date", end);

  publicationsQuery = profile?.department_id
    ? publicationsQuery.or(
        `user_id.eq.${authUser.id},department_id.eq.${profile.department_id}`
      )
    : publicationsQuery.eq("user_id", authUser.id);

  const { data: shiftPublications } = await publicationsQuery;
  const publicationMarkerMap = new Map<
    string,
    {
      date: string;
      mineCount: number;
      otherCount: number;
      boardHref: string;
    }
  >();

  for (const publication of shiftPublications ?? []) {
    const marker =
      publicationMarkerMap.get(publication.date) ??
      {
        date: publication.date,
        mineCount: 0,
        otherCount: 0,
        boardHref: "",
      };

    if (publication.user_id === authUser.id) {
      marker.mineCount += 1;
    } else {
      marker.otherCount += 1;
    }

    publicationMarkerMap.set(publication.date, marker);
  }

  const publicationMarkers = Array.from(publicationMarkerMap.values()).map(
    (marker) => {
      const params = new URLSearchParams({
        from: marker.date,
        to: marker.date,
        include_mine: "1",
      });

      if (profile?.department_id && marker.otherCount > 0) {
        params.set("department_id", profile.department_id);
      }

      return {
        ...marker,
        boardHref: `/shifts?${params.toString()}`,
      };
    }
  );

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
          publicationScope={publicationScope}
          publicationMarkers={publicationMarkers}
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
