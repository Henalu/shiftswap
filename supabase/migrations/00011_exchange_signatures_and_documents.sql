-- Migration: add signed exchange state, participant signatures, and PDF attachments
-- File path convention for exchange documents: {exchangeId}/document.pdf

ALTER TABLE exchanges
  DROP CONSTRAINT IF EXISTS exchanges_status_check;

ALTER TABLE exchanges
  ADD CONSTRAINT exchanges_status_check
  CHECK (status IN ('pending_confirmation', 'confirmed', 'signed', 'completed', 'cancelled'));

ALTER TABLE exchanges
  ADD COLUMN IF NOT EXISTS signed_by_user_a_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by_user_b_at TIMESTAMPTZ;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exchange-documents',
  'exchange-documents',
  true,
  10485760, -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Exchange documents are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'exchange-documents');

CREATE POLICY "Participants can upload exchange documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exchange-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM exchanges
      WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
    )
  );

CREATE POLICY "Participants can update exchange documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'exchange-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM exchanges
      WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
    )
  );

CREATE POLICY "Participants can delete exchange documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exchange-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM exchanges
      WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
    )
  );
