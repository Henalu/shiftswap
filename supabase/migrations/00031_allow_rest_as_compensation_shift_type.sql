-- Migration 00031: allow rest days as explicit compensation in exchange proposals.

ALTER TABLE public.exchanges
  DROP CONSTRAINT IF EXISTS exchanges_compensation_shift_type_check;

ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_compensation_shift_type_check
  CHECK (
    compensation_shift_type IS NULL
    OR compensation_shift_type IN (
      'morning',
      'afternoon',
      'night',
      'normal_full',
      'normal_short',
      'rest'
    )
  );

ALTER TABLE public.shift_requests
  DROP CONSTRAINT IF EXISTS shift_requests_compensation_shift_type_check;

ALTER TABLE public.shift_requests
  ADD CONSTRAINT shift_requests_compensation_shift_type_check
  CHECK (
    compensation_shift_type IS NULL
    OR compensation_shift_type IN (
      'morning',
      'afternoon',
      'night',
      'normal_full',
      'normal_short',
      'rest'
    )
  );
