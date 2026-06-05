-- Migration: user-level schedule preference
-- Lets each employee choose their own schedule type without changing the area default.

CREATE TABLE IF NOT EXISTS public.user_schedule_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('3t5', 'jornada_normal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_schedule_preferences_user
  ON public.user_schedule_preferences(user_id);

DROP TRIGGER IF EXISTS set_updated_at_user_schedule_preferences
  ON public.user_schedule_preferences;

CREATE TRIGGER set_updated_at_user_schedule_preferences
BEFORE UPDATE ON public.user_schedule_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_schedule_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule preference"
  ON public.user_schedule_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own schedule preference"
  ON public.user_schedule_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own schedule preference"
  ON public.user_schedule_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own schedule preference"
  ON public.user_schedule_preferences
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.user_schedule_preferences TO authenticated;
