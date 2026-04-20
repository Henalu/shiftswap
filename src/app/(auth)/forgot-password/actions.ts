"use server";

import { headers } from "next/headers";
import {
  AUTH_RATE_LIMITS,
  consumeRateLimit,
  getRequestIp,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-config";

export interface ForgotPasswordState {
  success?: true;
  error?: string;
}

function getRateLimitMessage(retryAfterSeconds: number) {
  const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Has solicitado demasiados correos de recuperacion. Espera ${retryAfterMinutes} min antes de volver a intentarlo.`;
}

export async function sendPasswordResetEmail(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();

  if (!email) {
    return { error: "Indica el email al que quieres enviar la recuperacion." };
  }

  const requestHeaders = await headers();
  const requestIp = getRequestIp(requestHeaders);
  const limiter = await consumeRateLimit({
    scope: "auth_password_reset_ip",
    identifier: requestIp,
    maxHits: AUTH_RATE_LIMITS.resetByIp.maxHits,
    windowSeconds: AUTH_RATE_LIMITS.resetByIp.windowSeconds,
  });

  if (!limiter.allowed) {
    return { error: getRateLimitMessage(limiter.retryAfterSeconds) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/reset-password`,
  });

  if (error) {
    return {
      error:
        "No se pudo iniciar la recuperacion de contraseña. " + error.message,
    };
  }

  return { success: true };
}
