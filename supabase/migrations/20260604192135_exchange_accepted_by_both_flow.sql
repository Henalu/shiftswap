-- Exchange flow update:
-- - Two participant signatures close the exchange.
-- - Responsible users are informed through notifications, not approval actions.
-- - Legacy pending_validation rows are normalized to approved.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'shift_request',
      'request_accepted',
      'request_rejected',
      'proposal_received',
      'proposal_accepted',
      'proposal_rejected',
      'shift_cancelled',
      'new_message',
      'exchange_confirmed',
      'exchange_signed',
      'exchange_document_added',
      'exchange_cancelled',
      'exchange_cancellation_requested',
      'exchange_cancellation_rejected',
      'exchange_pending_approval',
      'exchange_pending_validation',
      'exchange_accepted_by_both',
      'exchange_department_approved',
      'exchange_department_rejected',
      'account_approved',
      'account_rejected',
      'department_change_requested',
      'department_change_approved',
      'department_change_rejected',
      'job_position_change_requested',
      'job_position_change_approved',
      'job_position_change_rejected'
    )
  );

UPDATE public.exchanges
SET
  status = 'approved',
  approved_at = COALESCE(
    approved_at,
    signed_by_user_b_at,
    submitted_for_approval_at,
    NOW()
  ),
  submitted_for_approval_at = NULL,
  department_approver_id = NULL,
  department_reviewed_at = NULL,
  department_decision_notes = NULL,
  rejected_at = NULL
WHERE status = 'pending_validation';

UPDATE public.shift_debt_transactions AS debt
SET
  status = 'active',
  approved_at = COALESCE(debt.approved_at, NOW()),
  voided_at = NULL
FROM public.exchanges AS ex
WHERE
  debt.exchange_id = ex.id
  AND ex.status = 'approved'
  AND ex.agreement_type = 'hours_bank'
  AND debt.status = 'pending_approval';

UPDATE public.notifications
SET
  type = 'exchange_accepted_by_both',
  title = 'Intercambio aceptado por el equipo',
  body = 'Las dos partes han aceptado el cambio. No requiere aprobacion, solo queda informado.',
  data = COALESCE(data, '{}'::jsonb) ||
    jsonb_build_object('action_url', COALESCE(data->>'action_url', '/admin/exchanges')),
  updated_at = NOW()
WHERE
  type = 'exchange_pending_validation'
  AND resolved_at IS NULL;
