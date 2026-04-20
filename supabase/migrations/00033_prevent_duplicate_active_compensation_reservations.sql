-- Migration 00033: move exchange slot exclusivity from pending proposals to active exchanges.

DROP INDEX IF EXISTS public.idx_shift_requests_unique_active_compensation_reservation;

WITH ranked_shift_exchanges AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY shift_id
      ORDER BY
        CASE status
          WHEN 'completed' THEN 0
          WHEN 'approved' THEN 1
          WHEN 'pending_validation' THEN 2
          WHEN 'accepted' THEN 3
          ELSE 4
        END,
        created_at ASC,
        id ASC
    ) AS exchange_rank
  FROM public.exchanges
  WHERE status IN ('accepted', 'pending_validation', 'approved', 'completed')
),
ranked_compensation_exchanges AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_b_id, compensation_shift_date, compensation_shift_type
      ORDER BY
        CASE status
          WHEN 'completed' THEN 0
          WHEN 'approved' THEN 1
          WHEN 'pending_validation' THEN 2
          WHEN 'accepted' THEN 3
          ELSE 4
        END,
        created_at ASC,
        id ASC
    ) AS exchange_rank
  FROM public.exchanges
  WHERE agreement_type = 'shift_exchange'
    AND compensation_shift_date IS NOT NULL
    AND compensation_shift_type IS NOT NULL
    AND status IN ('accepted', 'pending_validation', 'approved', 'completed')
),
duplicate_exchange_ids AS (
  SELECT id
  FROM ranked_shift_exchanges
  WHERE exchange_rank > 1

  UNION

  SELECT id
  FROM ranked_compensation_exchanges
  WHERE exchange_rank > 1
)
UPDATE public.exchanges
SET status = 'cancelled',
    cancellation_requested_by = NULL,
    cancellation_requested_at = NULL,
    approved_at = NULL,
    rejected_at = NULL
WHERE id IN (SELECT id FROM duplicate_exchange_ids);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exchanges_unique_active_shift
  ON public.exchanges(shift_id)
  WHERE status IN ('accepted', 'pending_validation', 'approved', 'completed');

CREATE UNIQUE INDEX IF NOT EXISTS idx_exchanges_unique_active_compensation_slot
  ON public.exchanges(
    user_b_id,
    compensation_shift_date,
    compensation_shift_type
  )
  WHERE agreement_type = 'shift_exchange'
    AND compensation_shift_date IS NOT NULL
    AND compensation_shift_type IS NOT NULL
    AND status IN ('accepted', 'pending_validation', 'approved', 'completed');
