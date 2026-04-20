import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ShiftType } from "@/types";

interface WithdrawPendingCompensationProposalConflictsQuery {
  interestedUserId: string;
  compensationShiftDate: string;
  compensationShiftType: ShiftType;
  excludeRequestId?: string;
}

export interface PendingCompensationProposalConflict {
  id: string;
  shift_id: string;
  interested_user_id: string;
}

export async function withdrawPendingCompensationProposalConflicts({
  interestedUserId,
  compensationShiftDate,
  compensationShiftType,
  excludeRequestId,
}: WithdrawPendingCompensationProposalConflictsQuery): Promise<
  PendingCompensationProposalConflict[]
> {
  const supabase = createAdminClient();
  let query = supabase
    .from("shift_requests")
    .select("id, shift_id, interested_user_id")
    .eq("interested_user_id", interestedUserId)
    .eq("agreement_type", "shift_exchange")
    .eq("compensation_shift_date", compensationShiftDate)
    .eq("compensation_shift_type", compensationShiftType)
    .eq("status", "pending");

  if (excludeRequestId) {
    query = query.neq("id", excludeRequestId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "[compensation-proposals] Failed to load pending conflicts",
      {
        interestedUserId,
        compensationShiftDate,
        compensationShiftType,
        message: error.message,
      },
    );
    return [];
  }

  const conflicts = (data ?? []) as PendingCompensationProposalConflict[];

  if (conflicts.length === 0) {
    return [];
  }

  const { error: updateError } = await supabase
    .from("shift_requests")
    .update({ status: "withdrawn" })
    .in(
      "id",
      conflicts.map((conflict) => conflict.id),
    )
    .eq("status", "pending");

  if (updateError) {
    console.error(
      "[compensation-proposals] Failed to withdraw pending conflicts",
      {
        interestedUserId,
        compensationShiftDate,
        compensationShiftType,
        message: updateError.message,
      },
    );
    return [];
  }

  return conflicts;
}
