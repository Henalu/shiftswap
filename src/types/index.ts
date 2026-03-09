// ShiftSwap — Type Definitions

// ============================================
// Database types (mirror Supabase schema)
// ============================================

export type ShiftStatus = 'open' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type ExchangeStatus = 'pending_confirmation' | 'confirmed' | 'completed' | 'cancelled';
export type UserRole = 'employee' | 'supervisor' | 'admin';
export type ShiftType = 'morning' | 'afternoon' | 'night';

// ============================================
// User
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
// Company & Department
// ============================================

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  created_at: string;
}

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
  date: string; // ISO date
  start_time: string; // HH:MM
  end_time: string; // HH:MM
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
  requests_count: number;
}

// ============================================
// Shift Request
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
  user_a_id: string; // Original shift owner
  user_b_id: string; // Person covering
  status: ExchangeStatus;
  document_url?: string;
  confirmed_at?: string;
  created_at: string;
}

// ============================================
// Chat / Messages
// ============================================

export interface Conversation {
  id: string;
  shift_id: string;
  participant_a_id: string;
  participant_b_id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface ConversationWithLastMessage extends Conversation {
  last_message?: Message;
  other_user: UserProfile;
  unread_count: number;
}

// ============================================
// Notifications
// ============================================

export interface Notification {
  id: string;
  user_id: string;
  type: 'shift_request' | 'request_accepted' | 'new_message' | 'exchange_confirmed';
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, unknown>;
  created_at: string;
}
