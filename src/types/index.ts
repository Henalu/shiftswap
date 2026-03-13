// ShiftSwap — Type Definitions

// ============================================
// Status enums
// ============================================

export type ShiftStatus = 'open' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type ExchangeStatus = 'pending_confirmation' | 'confirmed' | 'signed' | 'completed' | 'cancelled';
export type UserRole = 'employee' | 'supervisor' | 'admin';
export type ShiftType = 'morning' | 'afternoon' | 'night';

// ============================================
// UserProfile
// ============================================

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  department_id: string;
  company_id: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
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
  document_url?: string;
  confirmed_at?: string;
  signed_by_user_a_at?: string;
  signed_by_user_b_at?: string;
  cancellation_requested_by?: string;
  cancellation_requested_at?: string;
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
  | 'new_message'
  | 'exchange_confirmed';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  data?: NotificationData;
  created_at: string;
}
