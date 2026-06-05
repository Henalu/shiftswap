-- Migration: normalize 3T5 to a shared 25-day cycle.
-- Real cycle: 5 work + 3 rest, 5 work + 3 rest, 5 work + 4 rest.
-- Two-night blocks get 3 rest days; the single-night block gets 4 rest days.

WITH canonical_pattern AS (
  INSERT INTO public.rotation_patterns (code, label, sequence)
  VALUES (
    '3T5_25',
    '3T5 (5-3, 5-3, 5-4)',
    ARRAY[
      'M','M','T','N','N','D','D','D',
      'M','T','T','N','N','D','D','D',
      'M','M','T','T','N','D','D','D','D'
    ]::TEXT[]
  )
  ON CONFLICT (code) DO UPDATE
    SET label = EXCLUDED.label,
        sequence = EXCLUDED.sequence
  RETURNING id
)
UPDATE public.rotation_groups AS rotation_group
SET rotation_pattern_id = canonical_pattern.id,
    reference_date = CASE rotation_group.code
      WHEN 'A' THEN DATE '2026-01-04'
      WHEN 'B' THEN DATE '2025-12-22'
      WHEN 'C' THEN DATE '2025-12-17'
      WHEN 'D' THEN DATE '2025-12-24'
      WHEN 'E' THEN DATE '2025-12-29'
      ELSE rotation_group.reference_date
    END
FROM canonical_pattern
WHERE rotation_group.code IN ('A', 'B', 'C', 'D', 'E');
