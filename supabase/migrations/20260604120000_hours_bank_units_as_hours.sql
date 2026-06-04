-- Store hours-bank debts in hours instead of "one whole shift".

WITH hours_bank_debts AS (
  SELECT
    debt.id,
    debtor.full_name AS debtor_name,
    creditor.full_name AS creditor_name,
    GREATEST(
      1,
      ROUND(
        (
          (
            EXTRACT(HOUR FROM shift_row.end_time)::INT * 60 +
            EXTRACT(MINUTE FROM shift_row.end_time)::INT
          ) -
          (
            EXTRACT(HOUR FROM shift_row.start_time)::INT * 60 +
            EXTRACT(MINUTE FROM shift_row.start_time)::INT
          ) +
          CASE
            WHEN shift_row.end_time > shift_row.start_time THEN 0
            ELSE 1440
          END
        )::NUMERIC / 60
      )::INT
    ) AS debt_hours
  FROM public.shift_debt_transactions debt
  JOIN public.exchanges exchange_row ON exchange_row.id = debt.exchange_id
  JOIN public.shifts shift_row ON shift_row.id = exchange_row.shift_id
  JOIN public.user_profiles debtor ON debtor.id = debt.debtor_user_id
  JOIN public.user_profiles creditor ON creditor.id = debt.creditor_user_id
  WHERE exchange_row.agreement_type = 'hours_bank'
    AND COALESCE(debt.metadata->>'units_kind', '') <> 'hours'
)
UPDATE public.shift_debt_transactions debt
SET
  units = hours_bank_debts.debt_hours,
  description =
    hours_bank_debts.debtor_name || ' queda debiendo ' ||
    hours_bank_debts.debt_hours ||
    CASE
      WHEN hours_bank_debts.debt_hours = 1 THEN ' hora a '
      ELSE ' horas a '
    END ||
    hours_bank_debts.creditor_name || ' dentro de la bolsa de horas.',
  metadata = COALESCE(debt.metadata, '{}'::jsonb) || jsonb_build_object(
    'agreement_type', 'hours_bank',
    'units_kind', 'hours'
  )
FROM hours_bank_debts
WHERE debt.id = hours_bank_debts.id;
