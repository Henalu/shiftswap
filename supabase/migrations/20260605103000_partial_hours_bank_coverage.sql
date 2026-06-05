-- Add optional partial coverage windows for hours-bank agreements.

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS coverage_start_time TIME,
  ADD COLUMN IF NOT EXISTS coverage_end_time TIME;

ALTER TABLE public.exchanges
  ADD COLUMN IF NOT EXISTS coverage_start_time TIME,
  ADD COLUMN IF NOT EXISTS coverage_end_time TIME;

ALTER TABLE public.shift_debt_transactions
  ALTER COLUMN units TYPE NUMERIC(6,2)
  USING units::NUMERIC;

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_coverage_window_check;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_coverage_window_check
  CHECK (
    (
      coverage_start_time IS NULL
      AND coverage_end_time IS NULL
    )
    OR (
      coverage_start_time IS NOT NULL
      AND coverage_end_time IS NOT NULL
      AND accepted_modalities = ARRAY['hours_bank']::TEXT[]
      AND coverage_start_time <> coverage_end_time
      AND EXTRACT(MINUTE FROM coverage_start_time)::INT IN (0, 30)
      AND EXTRACT(MINUTE FROM coverage_end_time)::INT IN (0, 30)
      AND EXTRACT(SECOND FROM coverage_start_time)::INT = 0
      AND EXTRACT(SECOND FROM coverage_end_time)::INT = 0
    )
  );

ALTER TABLE public.exchanges
  DROP CONSTRAINT IF EXISTS exchanges_coverage_window_check;

ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_coverage_window_check
  CHECK (
    (
      coverage_start_time IS NULL
      AND coverage_end_time IS NULL
    )
    OR (
      agreement_type = 'hours_bank'
      AND coverage_start_time IS NOT NULL
      AND coverage_end_time IS NOT NULL
      AND coverage_start_time <> coverage_end_time
      AND EXTRACT(MINUTE FROM coverage_start_time)::INT IN (0, 30)
      AND EXTRACT(MINUTE FROM coverage_end_time)::INT IN (0, 30)
      AND EXTRACT(SECOND FROM coverage_start_time)::INT = 0
      AND EXTRACT(SECOND FROM coverage_end_time)::INT = 0
    )
  );
