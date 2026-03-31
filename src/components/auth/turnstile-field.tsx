"use client";

import Script from "next/script";
import { useEffect, useId } from "react";

declare global {
  interface Window {
    [key: string]: ((token?: string) => void) | undefined;
  }
}

interface TurnstileFieldProps {
  error?: string | null;
  onTokenChange: (token: string) => void;
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function TurnstileField({
  error,
  onTokenChange,
}: TurnstileFieldProps) {
  const callbackId = useId().replace(/[:]/g, "");
  const successCallback = `turnstileSuccess_${callbackId}`;
  const expiredCallback = `turnstileExpired_${callbackId}`;
  const errorCallback = `turnstileError_${callbackId}`;

  useEffect(() => {
    if (!SITE_KEY) {
      return;
    }

    window[successCallback] = (token?: string) => {
      onTokenChange(token?.trim() ?? "");
    };
    window[expiredCallback] = () => {
      onTokenChange("");
    };
    window[errorCallback] = () => {
      onTokenChange("");
    };

    return () => {
      delete window[successCallback];
      delete window[expiredCallback];
      delete window[errorCallback];
    };
  }, [errorCallback, expiredCallback, onTokenChange, successCallback]);

  if (!SITE_KEY) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
      />
      <div
        className="cf-turnstile"
        data-sitekey={SITE_KEY}
        data-callback={successCallback}
        data-expired-callback={expiredCallback}
        data-error-callback={errorCallback}
        data-theme="light"
      />
      <p className="text-sm leading-6 text-muted-foreground">
        Protegemos el alta con una verificacion anti-bot cuando este entorno la
        tenga configurada.
      </p>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
