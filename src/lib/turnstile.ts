import "server-only";

import { getTurnstileSecretKey, isTurnstileEnabled } from "@/lib/app-config";

interface TurnstileVerificationResponse {
  success: boolean;
  "error-codes"?: string[];
}

export interface TurnstileVerificationResult {
  success: boolean;
  error?: string;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<TurnstileVerificationResult> {
  if (!isTurnstileEnabled()) {
    return { success: true };
  }

  if (!token?.trim()) {
    return {
      success: false,
      error: "Completa la verificacion anti-bot para continuar.",
    };
  }

  const body = new URLSearchParams();
  body.set("secret", getTurnstileSecretKey());
  body.set("response", token.trim());

  if (remoteIp?.trim()) {
    body.set("remoteip", remoteIp.trim());
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return {
      success: false,
      error:
        "No se pudo validar la comprobacion anti-bot. Intentalo de nuevo.",
    };
  }

  const payload =
    (await response.json()) as TurnstileVerificationResponse;

  if (!payload.success) {
    return {
      success: false,
      error:
        "La verificacion anti-bot no ha sido valida o ha caducado. Vuelve a intentarlo.",
    };
  }

  return { success: true };
}
