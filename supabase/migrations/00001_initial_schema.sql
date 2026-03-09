-- ShiftSwap — Initial Database Schema
-- Run this migration to set up the database

-- ============================================
-- Enable extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Companies
-- ============================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- Departments
-- ============================================
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(company_id, name)
);

CREATE INDEX idx_departments_company ON departments(company_id);

-- ============================================
-- User Profiles (extends auth.users)
-- ============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'supervisor', 'admin')),
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_profiles_company ON user_profiles(company_id);
CREATE INDEX idx_profiles_department ON user_profiles(department_id);

-- ============================================
-- Shifts
-- ============================================
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night')),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'confirmed', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_shifts_user ON shifts(user_id);
CREATE INDEX idx_shifts_department ON shifts(department_id);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_date ON shifts(date);

-- ============================================
-- Shift Requests (interest in a shift)
-- ============================================
CREATE TABLE shift_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  interested_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(shift_id, interested_user_id)
);

CREATE INDEX idx_requests_shift ON shift_requests(shift_id);
CREATE INDEX idx_requests_user ON shift_requests(interested_user_id);

-- ============================================
-- Conversations
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  participant_a_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  participant_b_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(shift_id, participant_a_id, participant_b_id)
);

CREATE INDEX idx_conversations_participants ON conversations(participant_a_id, participant_b_id);

-- ============================================
-- Messages
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- ============================================
-- Exchanges (confirmed shift swaps)
-- ============================================
CREATE TABLE exchanges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  user_a_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_confirmation' CHECK (status IN ('pending_confirmation', 'confirmed', 'completed', 'cancelled')),
  document_url TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_exchanges_shift ON exchanges(shift_id);
CREATE INDEX idx_exchanges_users ON exchanges(user_a_id, user_b_id);

-- ============================================
-- Notifications
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('shift_request', 'request_accepted', 'new_message', 'exchange_confirmed')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);

-- ============================================
-- Updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own company data
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  USING (id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Users can read departments in their company
CREATE POLICY "Users can view own company departments"
  ON departments FOR SELECT
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Users can read profiles in their company
CREATE POLICY "Users can view profiles in own company"
  ON user_profiles FOR SELECT
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid()));

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- Users can view shifts in their company (via department)
CREATE POLICY "Users can view shifts in own company"
  ON shifts FOR SELECT
  USING (department_id IN (
    SELECT d.id FROM departments d
    JOIN user_profiles up ON up.company_id = d.company_id
    WHERE up.id = auth.uid()
  ));

-- Users can create their own shifts
CREATE POLICY "Users can create own shifts"
  ON shifts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own shifts
CREATE POLICY "Users can update own shifts"
  ON shifts FOR UPDATE
  USING (user_id = auth.uid());

-- Users can view requests for their shifts or their own requests
CREATE POLICY "Users can view relevant requests"
  ON shift_requests FOR SELECT
  USING (
    interested_user_id = auth.uid()
    OR shift_id IN (SELECT id FROM shifts WHERE user_id = auth.uid())
  );

-- Users can create requests
CREATE POLICY "Users can create requests"
  ON shift_requests FOR INSERT
  WITH CHECK (interested_user_id = auth.uid());

-- Users can view their conversations
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (participant_a_id = auth.uid() OR participant_b_id = auth.uid());

-- Users can view messages in their conversations
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM conversations
    WHERE participant_a_id = auth.uid() OR participant_b_id = auth.uid()
  ));

-- Users can send messages in their conversations
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_a_id = auth.uid() OR participant_b_id = auth.uid()
    )
  );

-- Users can view their exchanges
CREATE POLICY "Users can view own exchanges"
  ON exchanges FOR SELECT
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- Users can view their notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());
