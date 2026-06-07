-- Migration: user suggestions
-- Stores one user suggestion per local app day and tracks optional email delivery.

CREATE TABLE IF NOT EXISTS public.suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  submitted_on DATE NOT NULL DEFAULT CURRENT_DATE,
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT suggestions_content_length_check
    CHECK (char_length(btrim(content)) BETWEEN 10 AND 2000),
  CONSTRAINT suggestions_email_status_check
    CHECK (email_status IN ('pending', 'sent', 'skipped', 'failed')),
  CONSTRAINT suggestions_one_per_user_day
    UNIQUE (user_id, submitted_on)
);

CREATE INDEX IF NOT EXISTS idx_suggestions_user_created
  ON public.suggestions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suggestions_company_created
  ON public.suggestions(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suggestions_submitted_on
  ON public.suggestions(submitted_on);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suggestions"
  ON public.suggestions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own suggestions"
  ON public.suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT
  ON public.suggestions TO authenticated;
