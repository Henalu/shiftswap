-- Tighten direct table grants for the self-service schedule preference table.
-- RLS still controls row access; these grants control which roles can reach the table at all.

REVOKE ALL ON TABLE public.user_schedule_preferences FROM anon;
REVOKE ALL ON TABLE public.user_schedule_preferences FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.user_schedule_preferences TO authenticated;
