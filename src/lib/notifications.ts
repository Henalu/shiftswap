import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationData, NotificationType } from "@/types";

interface NotificationFilters {
  userId?: string;
  userIds?: string[];
  dedupeKey?: string;
  dedupeKeys?: string[];
  types?: NotificationType[];
  dataContains?: NotificationData;
  unreadOnly?: boolean;
  unresolvedOnly?: boolean;
}

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  dedupeKey?: string;
}

interface FilterableQuery<TQuery> {
  eq(column: string, value: unknown): TQuery;
  in(column: string, values: unknown[]): TQuery;
  contains(column: string, value: Record<string, unknown>): TQuery;
  is(column: string, value: unknown): TQuery;
}

function applyNotificationFilters<TQuery extends FilterableQuery<TQuery>>(
  query: TQuery,
  filters: NotificationFilters
): TQuery {
  let nextQuery = query;

  if (filters.userId) {
    nextQuery = nextQuery.eq("user_id", filters.userId);
  }

  if (filters.userIds && filters.userIds.length > 0) {
    nextQuery = nextQuery.in("user_id", filters.userIds);
  }

  if (filters.dedupeKey) {
    nextQuery = nextQuery.eq("dedupe_key", filters.dedupeKey);
  }

  if (filters.dedupeKeys && filters.dedupeKeys.length > 0) {
    nextQuery = nextQuery.in("dedupe_key", filters.dedupeKeys);
  }

  if (filters.types && filters.types.length > 0) {
    nextQuery = nextQuery.in("type", filters.types);
  }

  if (filters.dataContains) {
    nextQuery = nextQuery.contains("data", filters.dataContains);
  }

  if (filters.unreadOnly) {
    nextQuery = nextQuery.eq("read", false);
  }

  if (filters.unresolvedOnly) {
    nextQuery = nextQuery.is("resolved_at", null);
  }

  return nextQuery;
}

export async function createNotification({
  userId,
  type,
  title,
  body,
  data,
  dedupeKey,
}: CreateNotificationInput): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    type,
    title,
    body,
    data,
    dedupe_key: dedupeKey ?? null,
    read: false,
    read_at: null,
    resolved_at: null,
    updated_at: now,
  };

  const { error } = dedupeKey
    ? await supabase
        .from("notifications")
        .upsert(payload, { onConflict: "user_id,dedupe_key" })
    : await supabase.from("notifications").insert(payload);

  if (error) {
    console.error("Failed to create notification", error.message, {
      userId,
      type,
      dedupeKey,
    });
  }
}

export async function markNotificationsAsRead(
  filters: NotificationFilters
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const query = applyNotificationFilters(
    supabase.from("notifications").update({
      read: true,
      read_at: now,
    }),
    filters
  );

  const { error } = await query;

  if (error) {
    console.error("Failed to mark notifications as read", error.message, filters);
  }
}

export async function resolveNotifications(
  filters: NotificationFilters
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const query = applyNotificationFilters(
    supabase.from("notifications").update({
      read: true,
      read_at: now,
      resolved_at: now,
    }),
    filters
  );

  const { error } = await query;

  if (error) {
    console.error("Failed to resolve notifications", error.message, filters);
  }
}
