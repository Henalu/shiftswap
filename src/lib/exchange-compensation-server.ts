import "server-only";

import {
  getHoursBankDescription,
  getHoursBankTransactionStatusForExchange,
} from "@/lib/exchange-compensation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ExchangeStatus, ShiftDebtTransactionStatus } from "@/types";

export async function upsertHoursBankDebtTransaction({
  exchangeId,
  exchangeStatus,
  debtorUserId,
  creditorUserId,
  debtorName,
  creditorName,
}: {
  exchangeId: string;
  exchangeStatus: ExchangeStatus;
  debtorUserId: string;
  creditorUserId: string;
  debtorName: string;
  creditorName: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const status = getHoursBankTransactionStatusForExchange(exchangeStatus);
  const now = new Date().toISOString();
  const { error } = await supabase.from("shift_debt_transactions").upsert(
    {
      exchange_id: exchangeId,
      debtor_user_id: debtorUserId,
      creditor_user_id: creditorUserId,
      movement_type: "hours_bank_debt",
      units: 1,
      status,
      description: getHoursBankDescription(debtorName, creditorName),
      metadata: {
        agreement_type: "hours_bank",
      },
      approved_at: status === "active" ? now : null,
      voided_at: status === "voided" ? now : null,
    },
    {
      onConflict: "exchange_id",
    }
  );

  if (error) {
    console.error("[exchange-compensation] Failed to upsert debt transaction", {
      exchangeId,
      message: error.message,
    });
  }
}

export async function syncHoursBankDebtTransactionStatus(
  exchangeId: string,
  status: ShiftDebtTransactionStatus
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("shift_debt_transactions")
    .update({
      status,
      approved_at: status === "active" ? now : null,
      voided_at: status === "voided" ? now : null,
    })
    .eq("exchange_id", exchangeId);

  if (error) {
    console.error("[exchange-compensation] Failed to sync debt transaction", {
      exchangeId,
      status,
      message: error.message,
    });
  }
}
