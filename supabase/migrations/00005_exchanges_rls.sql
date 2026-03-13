-- Migration: Add missing INSERT and UPDATE RLS policies for exchanges
-- The initial schema only added a SELECT policy.

-- Shift owner (user_a) can create an exchange record
CREATE POLICY "Shift owner can create exchanges"
  ON exchanges FOR INSERT
  WITH CHECK (user_a_id = auth.uid());

-- Both participants can update the exchange (confirm, cancel)
CREATE POLICY "Participants can update own exchanges"
  ON exchanges FOR UPDATE
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());
