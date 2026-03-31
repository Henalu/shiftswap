import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

interface RateLimitRpcResult {
  allowed: boolean;
  hit_count: number;
  retry_after_seconds: number;
}

export interface RateLimitOutcome {
  allowed: boolean;
  hitCount: number;
  retryAfterSeconds: number;
}

export interface RateLimitConfig {
  scope: string;
  identifier: string;
  maxHits: number;
  windowSeconds: number;
}

export const AUTH_RATE_LIMITS = {
  loginByIp: {
    maxHits: 8,
    windowSeconds: 15 * 60,
  },
  loginByEmail: {
    maxHits: 6,
    windowSeconds: 15 * 60,
  },
  registerByIp: {
    maxHits: 4,
    windowSeconds: 60 * 60,
  },
  resetByIp: {
    maxHits: 5,
    windowSeconds: 60 * 60,
  },
} as const;

function hashBucketKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getRequestIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export async function consumeRateLimit(
  config: RateLimitConfig
): Promise<RateLimitOutcome> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("consume_request_rate_limit", {
    target_scope: config.scope,
    target_bucket_key: hashBucketKey(config.identifier),
    max_hits: config.maxHits,
    window_seconds: config.windowSeconds,
  });

  if (error) {
    console.error("[rate-limit] Failed to consume limiter", {
      scope: config.scope,
      message: error.message,
    });

    return {
      allowed: true,
      hitCount: 0,
      retryAfterSeconds: 0,
    };
  }

  const typed = Array.isArray(data)
    ? ((data[0] as RateLimitRpcResult | undefined) ?? null)
    : ((data as RateLimitRpcResult | null) ?? null);

  if (!typed) {
    return {
      allowed: true,
      hitCount: 0,
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: typed.allowed,
    hitCount: typed.hit_count,
    retryAfterSeconds: typed.retry_after_seconds,
  };
}
