-- Migration: Add missing UPDATE policies for shift_requests
--
-- The initial schema only has SELECT and INSERT policies for shift_requests.
-- Without UPDATE policies:
--   - The shift owner cannot accept/reject requests (acceptRequest / rejectRequest actions)
--   - The interested user cannot withdraw their own request (toggleInterest action)
--   Both operations silently affect 0 rows — RLS filters without raising an error.
--
-- Fix: add two UPDATE policies:
--   1. Shift owners can update requests for their own shifts (accept / reject)
--   2. Interested users can update their own requests (withdraw)

-- 1. Shift owner: accept or reject any request on their shifts
CREATE POLICY "Shift owners can update requests on own shifts"
  ON shift_requests FOR UPDATE
  USING (
    shift_id IN (SELECT id FROM shifts WHERE user_id = auth.uid())
  )
  WITH CHECK (
    shift_id IN (SELECT id FROM shifts WHERE user_id = auth.uid())
  );

-- 2. Interested user: withdraw (or reactivate) their own request
CREATE POLICY "Users can update own shift requests"
  ON shift_requests FOR UPDATE
  USING (interested_user_id = auth.uid())
  WITH CHECK (interested_user_id = auth.uid());
