"use server";

export interface ExchangeApprovalMutationResult {
  success?: true;
  error?: string;
}

const EXCHANGE_APPROVAL_DISABLED_MESSAGE =
  "El responsable ya no aprueba intercambios. El cambio se cierra con las dos firmas y queda informado en la app.";

export async function approveExchangeRequest(
  formData: FormData,
): Promise<ExchangeApprovalMutationResult> {
  formData.get("exchange_id");

  return { error: EXCHANGE_APPROVAL_DISABLED_MESSAGE };
}

export async function rejectExchangeRequest(
  formData: FormData,
): Promise<ExchangeApprovalMutationResult> {
  formData.get("exchange_id");

  return { error: EXCHANGE_APPROVAL_DISABLED_MESSAGE };
}
