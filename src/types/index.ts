// ShiftSwap — Type Definitions

// ============================================
// Status enums
// ============================================

export type ShiftStatus = 'open' | 'negotiating' | 'completed' | 'cancelled' | 'expired';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type ExchangeStatus =
  | 'accepted'
  | 'pending_validation'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled'
  | 'expired';
export type ExchangeAgreementType = 'hours_bank' | 'shift_exchange';
export type ShiftDebtTransactionStatus =
  | 'pending_approval'
  | 'active'
  | 'voided'
  | 'settled';
export type ShiftDebtMovementType = 'hours_bank_debt';
export type DepartmentChangeRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';
export type JobPositionChangeRequestStatus = DepartmentChangeRequestStatus;
export type ValidationStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'member' | 'department_admin' | 'hr_admin' | 'super_admin';
export type ShiftType = 'morning' | 'afternoon' | 'night' | 'normal_full' | 'normal_short';
export type ScheduleTypeCode = '3t5' | 'jornada_normal';
export type CalendarDayType =
  | 'morning'
  | 'afternoon'
  | 'night'
  | 'rest'
  | 'normal_full'
  | 'normal_short'
  | 'vacation';
export type CalendarExchangeOverlayKind =
  | 'received'
  | 'delivered'
  | 'same_day_swap';
export interface CalendarExchangeOverlayEntry {
  exchangeId: string;
  date: string;
  kind: Exclude<CalendarExchangeOverlayKind, 'same_day_swap'>;
  shiftType: ShiftType;
}
// ============================================
// Calendar / Rotation
// ============================================

export interface RotationPattern {
  id: string;
  code: string;
  label: string;
  sequence: string[];
  cycle_length: number;
  created_at: string;
}

export interface RotationGroup {
  id: string;
  code: string;
  label: string;
  rotation_pattern_id: string;
  reference_date: string;
  created_at: string;
}

export interface AreaScheduleConfig {
  id: string;
  department_id: string;
  schedule_type: ScheduleTypeCode;
  created_at: string;
  updated_at: string;
}

export interface UserRotationAssignment {
  id: string;
  user_id: string;
  rotation_group_id: string;
  effective_from: string;
  created_at: string;
  updated_at: string;
}

export interface Vacation {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleOverride {
  id: string;
  user_id: string;
  date: string;
  override_type: string;
  reason?: string | null;
  created_by?: string | null;
  created_at: string;
}

export type BillingOwnerType = 'user' | 'company';
export type BillingAccessState =
  | 'inactive'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'blocked';
export type BillingEnforcementMode = 'off' | 'soft' | 'hard';
export type BillingSubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid';
export type BillingInterval = 'month' | 'year' | 'custom';

// ============================================
// UserProfile
// ============================================

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  department_id: string | null;
  job_position_id?: string | null;
  company_id: string | null;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  employee_id?: string | null;
  id_card_url?: string | null;
  validation_status?: ValidationStatus;
  validated_by?: string | null;
  validated_at?: string | null;
  validation_notes?: string | null;
  signature_url?: string | null;
  onboarding_completed_at?: string | null;
  is_admin?: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Company
// ============================================

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  theme_config?: Record<string, unknown> | null;
  created_at: string;
}

// ============================================
// Department
// ============================================

export interface Department {
  id: string;
  company_id: string;
  name: string;
  parent_department_id?: string | null;
  is_assignable?: boolean;
  created_at: string;
}

export interface JobPosition {
  id: string;
  company_id: string;
  department_id: string;
  name: string;
  code?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingPlan {
  id: string;
  code: string;
  owner_type: BillingOwnerType;
  name: string;
  description?: string | null;
  billing_interval: BillingInterval;
  currency: string;
  amount_cents: number;
  active: boolean;
  stripe_price_id?: string | null;
  cohort_code?: string | null;
  price_label?: string | null;
  stripe_price_env_var?: string | null;
  marketing_badge?: string | null;
  trial_days?: number;
  price_lock_months?: number;
  is_public?: boolean;
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

export interface BillingPricingCohort {
  code: string;
  label: string;
  description?: string | null;
  min_position: number;
  max_position?: number | null;
  trial_days: number;
  price_lock_months: number;
  discount_label: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingAccount {
  id: string;
  owner_type: BillingOwnerType;
  owner_user_id?: string | null;
  owner_company_id?: string | null;
  billing_plan_id?: string | null;
  pricing_cohort_code?: string | null;
  billing_interval?: BillingInterval | null;
  early_access_position?: number | null;
  provider: string;
  provider_customer_id?: string | null;
  billing_email?: string | null;
  current_billing_state: BillingAccessState;
  trial_ends_at?: string | null;
  price_lock_ends_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingSubscription {
  id: string;
  billing_account_id: string;
  billing_plan_id?: string | null;
  provider: string;
  provider_subscription_id: string;
  provider_price_id?: string | null;
  status: BillingSubscriptionStatus;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end: boolean;
  canceled_at?: string | null;
  trial_start?: string | null;
  trial_end?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BillingInvoice {
  id: string;
  billing_account_id: string;
  billing_subscription_id?: string | null;
  provider: string;
  provider_invoice_id: string;
  status: string;
  currency: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  hosted_invoice_url?: string | null;
  invoice_pdf_url?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingWebhookEvent {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  payload?: Record<string, unknown> | null;
  processed: boolean;
  processed_at?: string | null;
  created_at: string;
}

// ============================================
// Shift
// ============================================

export type AcceptedModality = 'hours_bank' | 'shift_exchange';

export interface Shift {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  shift_type: ShiftType;
  department_id: string;
  direct_recipient_id?: string | null;
  description?: string;
  status: ShiftStatus;
  accepted_modalities: AcceptedModality[];
  created_at: string;
  updated_at: string;
}

export interface ShiftWithUser extends Shift {
  user: UserProfile;
  department: Department;
}

// ============================================
// ShiftRequest
// ============================================

export interface ShiftRequest {
  id: string;
  shift_id: string;
  interested_user_id: string;
  message?: string;
  agreement_type: ExchangeAgreementType;
  compensation_shift_date?: string | null;
  compensation_shift_type?: ShiftType | "rest" | null;
  status: RequestStatus;
  created_at: string;
}

export interface ShiftRequestWithUser extends ShiftRequest {
  user: UserProfile;
}

// ============================================
// Exchange
// ============================================

export interface Exchange {
  id: string;
  shift_id: string;
  user_a_id: string;
  user_b_id: string;
  status: ExchangeStatus;
  agreement_type?: ExchangeAgreementType | null;
  compensation_shift_date?: string | null;
  compensation_shift_type?: ShiftType | "rest" | null;
  document_url?: string;
  confirmed_at?: string;
  signed_by_user_a_at?: string;
  signed_by_user_b_at?: string;
  signed_by_user_a_name?: string | null;
  signed_by_user_b_name?: string | null;
  submitted_for_approval_at?: string | null;
  department_approver_id?: string | null;
  department_reviewed_at?: string | null;
  department_decision_notes?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  cancellation_requested_by?: string;
  cancellation_requested_at?: string;
  created_at: string;
}

export interface ShiftDebtTransaction {
  id: string;
  exchange_id: string;
  debtor_user_id: string;
  creditor_user_id: string;
  movement_type: ShiftDebtMovementType;
  units: number;
  status: ShiftDebtTransactionStatus;
  description?: string | null;
  metadata?: Record<string, unknown>;
  approved_at?: string | null;
  voided_at?: string | null;
  settled_at?: string | null;
  created_at: string;
}

export interface DepartmentChangeRequest {
  id: string;
  user_id: string;
  company_id: string;
  current_department_id: string;
  requested_department_id: string;
  request_reason?: string | null;
  status: DepartmentChangeRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobPositionChangeRequest {
  id: string;
  user_id: string;
  company_id: string;
  current_department_id: string;
  current_job_position_id?: string | null;
  requested_job_position_id: string;
  request_reason?: string | null;
  status: JobPositionChangeRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type ExchangeEventType =
  | 'proposal_accepted'
  | 'interested_signed'
  | 'submitted_for_validation'
  | 'department_approved'
  | 'department_rejected'
  | 'exchange_cancelled'
  | 'exchange_expired'
  | 'cancellation_requested'
  | 'cancellation_rejected'
  | 'support_document_attached';

export interface ExchangeEvent {
  id: string;
  exchange_id: string;
  actor_id?: string | null;
  event_type: ExchangeEventType;
  from_status?: string | null;
  to_status?: string | null;
  title: string;
  details?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ============================================
// Conversation
// ============================================

export interface Conversation {
  id: string;
  shift_id: string | null;
  participant_a_id: string;
  participant_b_id: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Message
// ============================================

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

// ============================================
// Notification
// ============================================

export interface NotificationData {
  action_url?: string;
  shift_id?: string;
  exchange_id?: string;
  conversation_id?: string;
  [key: string]: unknown;
}

export type NotificationType =
  | 'proposal_received'
  | 'proposal_accepted'
  | 'proposal_rejected'
  | 'shift_cancelled'
  | 'new_message'
  | 'exchange_signed'
  | 'exchange_document_added'
  | 'exchange_cancelled'
  | 'exchange_cancellation_requested'
  | 'exchange_cancellation_rejected'
  | 'exchange_pending_validation'
  | 'exchange_department_approved'
  | 'exchange_department_rejected'
  | 'department_change_requested'
  | 'department_change_approved'
  | 'department_change_rejected'
  | 'job_position_change_requested'
  | 'job_position_change_approved'
  | 'job_position_change_rejected'
  | 'account_approved'
  | 'account_rejected';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  read_at?: string | null;
  resolved_at?: string | null;
  dedupe_key?: string | null;
  data?: NotificationData;
  created_at: string;
  updated_at?: string;
}
