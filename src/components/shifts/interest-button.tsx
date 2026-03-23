"use client";

import { useActionState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleInterest } from "./actions";

interface InterestButtonProps {
  shiftId: string;
  initialInterested: boolean;
  requestId: string | null;
}

export function InterestButton({
  shiftId,
  initialInterested,
  requestId: initialRequestId,
}: InterestButtonProps) {
  const [state, formAction, isPending] = useActionState(toggleInterest, null);

  const interested = state?.success ? !!state.interested : initialInterested;
  const currentRequestId = state?.success
    ? (state.requestId ?? null)
    : initialRequestId;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="shift_id" value={shiftId} />
      {currentRequestId && (
        <input type="hidden" name="request_id" value={currentRequestId} />
      )}
      <Button
        type="submit"
        variant={interested ? "secondary" : "default"}
        size="sm"
        disabled={isPending}
        aria-pressed={interested}
        className="min-w-[10rem]"
      >
        <Heart
          className="size-4"
          fill={interested ? "currentColor" : "none"}
        />
        {isPending ? "Actualizando..." : interested ? "Interesado" : "Me interesa"}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
