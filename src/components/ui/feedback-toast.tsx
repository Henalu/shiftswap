"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

interface FeedbackToastProps {
  errorMessage?: string | null;
  successMessage?: string | null;
}

export function FeedbackToast({
  errorMessage,
  successMessage,
}: FeedbackToastProps) {
  const pathname = usePathname();
  const router = useRouter();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) {
      return;
    }

    const message = errorMessage ?? successMessage;
    if (!message) {
      return;
    }

    shownRef.current = true;

    if (errorMessage) {
      toast.error(errorMessage, { duration: 4500 });
    } else {
      toast.success(message, { duration: 3500 });
    }

    router.replace(pathname, { scroll: false });
  }, [errorMessage, pathname, router, successMessage]);

  return null;
}
