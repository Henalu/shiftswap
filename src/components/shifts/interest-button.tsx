"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toggleInterest } from "./actions";

interface InterestButtonProps {
  shiftId: string;
  initialInterested: boolean;
  requestId: string | null;
}

export function InterestButton({ shiftId, initialInterested, requestId: initialRequestId }: InterestButtonProps) {
  const [state, formAction, isPending] = useActionState(toggleInterest, null);

  const interested = state?.success ? !!state.interested : initialInterested;
  const currentRequestId = state?.success ? (state.requestId ?? null) : initialRequestId;

  return (
    <form action={formAction}>
      <input type="hidden" name="shift_id" value={shiftId} />
      {currentRequestId && (
        <input type="hidden" name="request_id" value={currentRequestId} />
      )}
      <Button
        type="submit"
        variant={interested ? "outline" : "default"}
        size="sm"
        disabled={isPending}
      >
        <Heart
          className="mr-2 size-4"
          fill={interested ? "currentColor" : "none"}
          style={interested ? { color: "#f472b6" } : undefined}
        />
        {isPending ? "..." : interested ? "Interesado" : "Me interesa"}
      </Button>
      {state?.error && (
        <p className="mt-2 text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
