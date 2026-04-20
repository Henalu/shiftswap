"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_RATE_LIMITS,
  consumeRateLimit,
  getRequestIp,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export interface LoginActionState {
  error?: string;
}

function getRateLimitMessage(retryAfterSeconds: number) {
  const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Has alcanzado el limite de intentos. Espera ${retryAfterMinutes} min y vuelve a intentarlo.`;
}

export async function loginWithPassword(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return { error: "Introduce tu email y tu contraseña para continuar." };
  }

  const requestHeaders = await headers();
  const requestIp = getRequestIp(requestHeaders);

  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit({
      scope: "auth_login_ip",
      identifier: requestIp,
      maxHits: AUTH_RATE_LIMITS.loginByIp.maxHits,
      windowSeconds: AUTH_RATE_LIMITS.loginByIp.windowSeconds,
    }),
    consumeRateLimit({
      scope: "auth_login_email",
      identifier: email,
      maxHits: AUTH_RATE_LIMITS.loginByEmail.maxHits,
      windowSeconds: AUTH_RATE_LIMITS.loginByEmail.windowSeconds,
    }),
  ]);

  if (!byIp.allowed) {
    return { error: getRateLimitMessage(byIp.retryAfterSeconds) };
  }

  if (!byEmail.allowed) {
    return { error: getRateLimitMessage(byEmail.retryAfterSeconds) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos."
          : error.message,
    };
  }

  redirect("/shifts");
}
