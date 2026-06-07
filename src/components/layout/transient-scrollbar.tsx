"use client";

import {
  type ComponentPropsWithoutRef,
  useEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

function useTransientScrollbar() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  return (element: HTMLElement) => {
    element.dataset.scrolling = "true";

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      delete element.dataset.scrolling;
    }, 700);
  };
}

type TransientScrollbarMainProps = ComponentPropsWithoutRef<"main">;
type TransientScrollbarNavProps = ComponentPropsWithoutRef<"nav">;

export function TransientScrollbarMain({
  className,
  onScroll,
  ...props
}: TransientScrollbarMainProps) {
  const showScrollbar = useTransientScrollbar();
  const handleScroll: TransientScrollbarMainProps["onScroll"] = (event) => {
    showScrollbar(event.currentTarget);
    onScroll?.(event);
  };

  return (
    <main
      className={cn("scrollbar-fade", className)}
      onScroll={handleScroll}
      {...props}
    />
  );
}

export function TransientScrollbarNav({
  className,
  onScroll,
  ...props
}: TransientScrollbarNavProps) {
  const showScrollbar = useTransientScrollbar();
  const handleScroll: TransientScrollbarNavProps["onScroll"] = (event) => {
    showScrollbar(event.currentTarget);
    onScroll?.(event);
  };

  return (
    <nav
      className={cn("scrollbar-fade", className)}
      onScroll={handleScroll}
      {...props}
    />
  );
}
