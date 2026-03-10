"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { showInterest } from "./actions";

interface InterestButtonProps {
  shiftId: string;
}

export function InterestButton({ shiftId }: InterestButtonProps) {
  const [state, formAction] = useActionState(showInterest, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="shift_id" value={shiftId} />
      <Button type="submit" variant="default" size="sm">
        <Heart className="mr-2 size-4" />
        Me interesa
      </Button>
      {state?.error && (
        <p className="mt-2 text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
