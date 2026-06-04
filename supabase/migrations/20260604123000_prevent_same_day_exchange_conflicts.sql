-- Prevent one user from holding several active exchange commitments on the same date.

WITH active_exchange_dates AS (
  SELECT
    exchange_row.id,
    participant_slot.user_id,
    participant_slot.work_date,
    exchange_row.status,
    exchange_row.created_at
  FROM public.exchanges AS exchange_row
  JOIN public.shifts AS shift_row ON shift_row.id = exchange_row.shift_id
  CROSS JOIN LATERAL (
    VALUES
      (exchange_row.user_a_id, shift_row.date),
      (exchange_row.user_b_id, shift_row.date),
      (
        CASE
          WHEN exchange_row.agreement_type = 'shift_exchange' THEN exchange_row.user_a_id
          ELSE NULL
        END,
        CASE
          WHEN exchange_row.agreement_type = 'shift_exchange' THEN exchange_row.compensation_shift_date
          ELSE NULL
        END
      ),
      (
        CASE
          WHEN exchange_row.agreement_type = 'shift_exchange' THEN exchange_row.user_b_id
          ELSE NULL
        END,
        CASE
          WHEN exchange_row.agreement_type = 'shift_exchange' THEN exchange_row.compensation_shift_date
          ELSE NULL
        END
      )
  ) AS participant_slot(user_id, work_date)
  WHERE exchange_row.status IN ('accepted', 'pending_validation', 'approved', 'completed')
    AND participant_slot.user_id IS NOT NULL
    AND participant_slot.work_date IS NOT NULL
),
ranked_exchange_dates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, work_date
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
  FROM active_exchange_dates
),
duplicate_exchange_ids AS (
  SELECT DISTINCT id
  FROM ranked_exchange_dates
  WHERE exchange_rank > 1
)
UPDATE public.exchanges
SET status = 'cancelled',
    cancellation_requested_by = NULL,
    cancellation_requested_at = NULL,
    approved_at = NULL,
    rejected_at = NULL
WHERE id IN (SELECT id FROM duplicate_exchange_ids);

WITH active_shift_slots AS (
  SELECT
    shift_row.id,
    ROW_NUMBER() OVER (
      PARTITION BY shift_row.user_id, shift_row.date, shift_row.shift_type
      ORDER BY
        CASE shift_row.status
          WHEN 'negotiating' THEN 0
          WHEN 'open' THEN 1
          ELSE 2
        END,
        shift_row.created_at ASC,
        shift_row.id ASC
    ) AS shift_rank
  FROM public.shifts AS shift_row
  WHERE shift_row.status IN ('open', 'negotiating')
)
UPDATE public.shifts
SET status = 'cancelled',
    updated_at = NOW()
WHERE id IN (
  SELECT id
  FROM active_shift_slots
  WHERE shift_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_unique_active_user_slot
  ON public.shifts(user_id, date, shift_type)
  WHERE status IN ('open', 'negotiating');

CREATE OR REPLACE FUNCTION public.prevent_active_exchange_same_day_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  active_statuses TEXT[] := ARRAY['accepted', 'pending_validation', 'approved', 'completed'];
  base_shift_date DATE;
  checked_user_id UUID;
  checked_work_date DATE;
  has_conflict BOOLEAN;
BEGIN
  IF NOT (NEW.status = ANY(active_statuses)) THEN
    RETURN NEW;
  END IF;

  SELECT date
  INTO base_shift_date
  FROM public.shifts
  WHERE id = NEW.shift_id;

  IF base_shift_date IS NULL THEN
    RETURN NEW;
  END IF;

  FOR checked_user_id, checked_work_date IN
    SELECT slot.user_id, slot.work_date
    FROM (
      VALUES
        (NEW.user_a_id, base_shift_date),
        (NEW.user_b_id, base_shift_date),
        (
          CASE
            WHEN NEW.agreement_type = 'shift_exchange' THEN NEW.user_a_id
            ELSE NULL
          END,
          CASE
            WHEN NEW.agreement_type = 'shift_exchange' THEN NEW.compensation_shift_date
            ELSE NULL
          END
        ),
        (
          CASE
            WHEN NEW.agreement_type = 'shift_exchange' THEN NEW.user_b_id
            ELSE NULL
          END,
          CASE
            WHEN NEW.agreement_type = 'shift_exchange' THEN NEW.compensation_shift_date
            ELSE NULL
          END
        )
    ) AS slot(user_id, work_date)
    WHERE slot.user_id IS NOT NULL
      AND slot.work_date IS NOT NULL
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.exchanges AS existing_exchange
      JOIN public.shifts AS existing_shift
        ON existing_shift.id = existing_exchange.shift_id
      WHERE existing_exchange.id IS DISTINCT FROM NEW.id
        AND existing_exchange.status = ANY(active_statuses)
        AND (
          (
            (existing_exchange.user_a_id = checked_user_id OR existing_exchange.user_b_id = checked_user_id)
            AND existing_shift.date = checked_work_date
          )
          OR (
            existing_exchange.agreement_type = 'shift_exchange'
            AND existing_exchange.compensation_shift_date = checked_work_date
            AND (existing_exchange.user_a_id = checked_user_id OR existing_exchange.user_b_id = checked_user_id)
          )
        )
    )
    INTO has_conflict;

    IF has_conflict THEN
      RAISE EXCEPTION 'active_exchange_date_conflict'
        USING ERRCODE = '23505',
              DETAIL = 'User already has an active exchange on this date.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_active_exchange_same_day_conflicts
  ON public.exchanges;

CREATE TRIGGER prevent_active_exchange_same_day_conflicts
BEFORE INSERT OR UPDATE OF status, user_a_id, user_b_id, shift_id, agreement_type, compensation_shift_date
ON public.exchanges
FOR EACH ROW
EXECUTE FUNCTION public.prevent_active_exchange_same_day_conflicts();

CREATE OR REPLACE FUNCTION public.prevent_shift_active_exchange_slot_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  has_conflict BOOLEAN;
BEGIN
  IF NEW.status NOT IN ('open', 'negotiating') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.exchanges AS exchange_row
    JOIN public.shifts AS shift_row ON shift_row.id = exchange_row.shift_id
    WHERE exchange_row.status IN ('accepted', 'pending_validation', 'approved', 'completed')
      AND (
        (
          exchange_row.shift_id <> NEW.id
          AND (exchange_row.user_a_id = NEW.user_id OR exchange_row.user_b_id = NEW.user_id)
          AND shift_row.date = NEW.date
          AND shift_row.shift_type = NEW.shift_type
        )
        OR (
          exchange_row.agreement_type = 'shift_exchange'
          AND exchange_row.compensation_shift_date = NEW.date
          AND exchange_row.compensation_shift_type = NEW.shift_type
          AND (exchange_row.user_a_id = NEW.user_id OR exchange_row.user_b_id = NEW.user_id)
        )
      )
  )
  INTO has_conflict;

  IF has_conflict THEN
    RAISE EXCEPTION 'active_exchange_shift_slot_conflict'
      USING ERRCODE = '23505',
            DETAIL = 'This shift slot already belongs to an active exchange.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_shift_active_exchange_slot_conflicts
  ON public.shifts;

CREATE TRIGGER prevent_shift_active_exchange_slot_conflicts
BEFORE INSERT OR UPDATE OF status, user_id, date, shift_type
ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_shift_active_exchange_slot_conflicts();
