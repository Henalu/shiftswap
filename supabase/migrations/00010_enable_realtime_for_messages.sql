-- Migration: Ensure chat messages are published to Supabase Realtime
--
-- Without adding `messages` to the `supabase_realtime` publication,
-- postgres_changes subscriptions receive no INSERT events for chat rows.
-- The UI would only show new messages after a manual refresh.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
  END IF;
END;
$$;
