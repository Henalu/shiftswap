-- Migration: Phase 3 — Signature pad + onboarding flag
-- signature_url: public URL of the user's drawn signature (PNG in Storage)
-- onboarding_completed_at: NULL means the user hasn't dismissed the onboarding modal yet

-- 1. Add columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- 2. Create signatures storage bucket (public, PNG only, 2 MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signatures',
  'signatures',
  true,
  2097152, -- 2 MB limit
  ARRAY['image/png']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS for signatures (same pattern as avatars)
CREATE POLICY "Signature images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'signatures');

CREATE POLICY "Users can upload their own signature"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'signatures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own signature"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'signatures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own signature"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'signatures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
