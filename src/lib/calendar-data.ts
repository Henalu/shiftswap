import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getDepartmentArea } from "@/lib/departments";
import type { CalendarConfig, CalendarInput, CalendarDay } from "@/lib/calendar";
import { generateCalendar } from "@/lib/calendar";
import type { Department } from "@/types";

// ============================================
// Data fetching for calendar generation
// ============================================

interface GetUserCalendarInputOptions {
  userId: string;
  startDate: string;
  endDate: string;
}

/**
 * Load all data needed to generate a user's calendar.
 * Uses admin client to bypass column-level grants.
 *
 * Returns { configured: false } if the user has no area config or
 * (for 3t5) no rotation assignment. The UI degrades gracefully.
 */
export async function getUserCalendarInput({
  userId,
  startDate,
  endDate,
}: GetUserCalendarInputOptions): Promise<CalendarConfig> {
  const admin = createAdminClient();

  // 1. Get user's department
  const { data: profile } = await admin
    .from("user_profiles")
    .select("department_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.department_id) {
    return { configured: false };
  }

  // 2. Resolve the area (parent department) for this user
  const { data: departments } = await admin
    .from("departments")
    .select("id, company_id, name, parent_department_id, is_assignable, created_at")
    .order("name");

  if (!departments) {
    return { configured: false };
  }

  const area = getDepartmentArea(departments as Department[], profile.department_id);
  if (!area) {
    return { configured: false };
  }

  // 3. Check area_schedule_config for the area
  const { data: areaConfig } = await admin
    .from("area_schedule_configs")
    .select("schedule_type")
    .eq("department_id", area.id)
    .maybeSingle();

  if (!areaConfig) {
    return { configured: false };
  }

  // 4. Load vacations + overrides in parallel
  const [{ data: vacations }, { data: overrides }] = await Promise.all([
    admin
      .from("vacations")
      .select("start_date, end_date")
      .eq("user_id", userId)
      .lte("start_date", endDate)
      .gte("end_date", startDate),
    admin
      .from("schedule_overrides")
      .select("date, override_type")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate),
  ]);

  const base: Omit<CalendarInput, "rotation"> & { rotation?: CalendarInput["rotation"] } = {
    configured: true,
    scheduleType: areaConfig.schedule_type,
    vacations: vacations ?? [],
    overrides: overrides ?? [],
  };

  // 5. For 3t5, load rotation group + pattern
  if (areaConfig.schedule_type === "3t5") {
    const { data: assignment } = await admin
      .from("user_rotation_assignments")
      .select("rotation_group_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!assignment) {
      return { configured: false };
    }

    const { data: group } = await admin
      .from("rotation_groups")
      .select("reference_date, rotation_pattern_id")
      .eq("id", assignment.rotation_group_id)
      .maybeSingle();

    if (!group) {
      return { configured: false };
    }

    const { data: pattern } = await admin
      .from("rotation_patterns")
      .select("sequence")
      .eq("id", group.rotation_pattern_id)
      .maybeSingle();

    if (!pattern) {
      return { configured: false };
    }

    base.rotation = {
      sequence: pattern.sequence,
      referenceDate: group.reference_date,
    };
  }

  return base as CalendarInput;
}

/**
 * Fetch + generate calendar in a single call.
 * Returns null if user has no calendar config.
 */
export async function getUserCalendar(
  userId: string,
  startDate: string,
  endDate: string
): Promise<CalendarDay[] | null> {
  const config = await getUserCalendarInput({ userId, startDate, endDate });

  if (!config.configured) {
    return null;
  }

  return generateCalendar(startDate, endDate, config);
}
