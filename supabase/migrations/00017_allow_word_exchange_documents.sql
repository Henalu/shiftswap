-- Allow Word documents in exchange-documents bucket so users can
-- download, complete, and re-upload the official Cambio de Turno template.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
WHERE id = 'exchange-documents';
