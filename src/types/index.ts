// ShiftSwap — Type Definitions

// ============================================
// Status enums
// ============================================

export type ShiftStatus = 'open' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type ExchangeStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'pending_department_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';
export type ExchangeAgreementType = 'hours_bank' | 'shift_exchange';
export type ShiftDebtTransactionStatus =
  | 'pending_approval'
  | 'active'
  | 'voided'
  | 'settled';
export type ShiftDebtMovementType = 'hours_bank_debt';
export type ValidationStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'member' | 'department_admin' | 'hr_admin' | 'super_admin';
export type ShiftType = 'morning' | 'afternoon' | 'night';

// ============================================
// UserProfile
// ============================================

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  department_id: string | null;
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
  created_at: string;
}

// ============================================
// Shift
// ============================================

export interface Shift {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  shift_type: ShiftType;
  department_id: string;
  description?: string;
  status: ShiftStatus;
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
  compensation_shift_type?: ShiftType | null;
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

export type ExchangeEventType =
  | 'exchange_created'
  | 'agreement_confirmed'
  | 'participant_signed'
  | 'submitted_for_approval'
  | 'department_approved'
  | 'department_rejected'
  | 'exchange_cancelled'
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
  shift_id: string;
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
  | 'shift_request'
  | 'request_accepted'
  | 'request_rejected'
  | 'shift_cancelled'
  | 'new_message'
  | 'exchange_confirmed'
  | 'exchange_signed'
  | 'exchange_document_added'
  | 'exchange_cancelled'
  | 'exchange_cancellation_requested'
  | 'exchange_cancellation_rejected'
  | 'exchange_pending_approval'
  | 'exchange_department_approved'
  | 'exchange_department_rejected'
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
