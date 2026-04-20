-- Migration 00032: disallow rest days as compensation in exchange proposals.

UPDATE public.exchanges
SET compensation_shift_type = NULL,
    compensation_shift_date  = NULL
WHERE compensation_shift_type = 'rest';

-- Delete shift_requests with rest compensation: the consistency constraint on shift_exchange
-- requires both compensation fields non-null, so nulling them is not possible without
-- also changing agreement_type. These rows are invalid and safe to remove.
DELETE FROM public.shift_requests
WHERE compensation_shift_type = 'rest';

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
      'normal_short'
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
      'normal_short'
    )
  );
