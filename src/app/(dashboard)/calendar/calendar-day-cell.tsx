"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CALENDAR_EXCHANGE_OVERLAY_DOT_COLORS,
  CALENDAR_EXCHANGE_OVERLAY_LABELS,
  CALENDAR_EXCHANGE_OVERLAY_STYLES,
  CALENDAR_DAY_TYPE_LABELS,
  CALENDAR_DAY_TYPE_STYLES,
  CALENDAR_DAY_TYPE_DOT_COLORS,
  CALENDAR_PUBLICATION_MARKER_DOT_COLORS,
  CALENDAR_PUBLICATION_MARKER_LABELS,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import type { CalendarDay } from "@/lib/calendar";

interface CalendarDayCellProps {
  day: CalendarDay;
  isToday: boolean;
  onPublish?: () => void;
  publicationMarker?: {
    mineCount: number;
    otherCount: number;
  } | null;
  boardHref?: string;
}

export function CalendarDayCell({
  day,
  isToday,
  onPublish,
  publicationMarker = null,
  boardHref,
}: CalendarDayCellProps) {
  const router = useRouter();
  const clickTimeoutRef = useRef<number | null>(null);
  const dayNum = parseInt(day.date.slice(8, 10), 10);
  const label = CALENDAR_DAY_TYPE_LABELS[day.dayType];
  const style = CALENDAR_DAY_TYPE_STYLES[day.dayType];
  const dotColor = CALENDAR_DAY_TYPE_DOT_COLORS[day.dayType];
  const exchangeOverlay = day.exchangeOverlay;
  const exchangeLabel = exchangeOverlay
    ? CALENDAR_EXCHANGE_OVERLAY_LABELS[exchangeOverlay.kind]
    : null;
  const exchangeDotColor = exchangeOverlay
    ? CALENDAR_EXCHANGE_OVERLAY_DOT_COLORS[exchangeOverlay.kind]
    : null;
  const exchangeSummary = exchangeOverlay
    ? exchangeOverlay.kind === "same_day_swap"
      ? `Recibes ${exchangeOverlay.receivedShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.receivedShiftType] : "otro turno"} y cedes ${exchangeOverlay.deliveredShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.deliveredShiftType] : "tu turno original"}`
      : exchangeOverlay.kind === "received"
        ? `Recibes ${exchangeOverlay.receivedShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.receivedShiftType] : "otro turno"}`
        : `Cedes ${exchangeOverlay.deliveredShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.deliveredShiftType] : "tu turno original"}`
    : null;
  const hasMyPublications = (publicationMarker?.mineCount ?? 0) > 0;
  const hasOtherPublications = (publicationMarker?.otherCount ?? 0) > 0;
  const hasPublicationMarker = hasMyPublications || hasOtherPublications;
  const publicationSummary = [
    hasMyPublications ? CALENDAR_PUBLICATION_MARKER_LABELS.mine : null,
    hasOtherPublications ? CALENDAR_PUBLICATION_MARKER_LABELS.other : null,
  ]
    .filter(Boolean)
    .join(", ");
  const isInteractive = Boolean(onPublish || boardHref);
  const ariaLabel = `${dayNum}, ${label}${exchangeLabel ? `, ${exchangeLabel.toLowerCase()}` : ""}${publicationSummary ? `, ${publicationSummary.toLowerCase()}` : ""}${day.isOverride ? ", modificado por administrador" : ""}${isToday ? ", hoy" : ""}${boardHref ? ", clic para ver publicaciones del dia en el tablon" : ""}${onPublish ? ", doble clic para publicar desde este dia" : ""}`;
  const className = cn(
    "group relative flex h-full min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 rounded-lg border p-1.5 text-center transition-colors sm:min-h-[4.5rem] sm:items-start sm:justify-start sm:p-2",
    style,
    isToday && "ring-2 ring-inset ring-primary",
    isInteractive &&
      "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
  );

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  function clearPendingBoardNavigation() {
    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
  }

  function handleClick() {
    if (!boardHref) {
      return;
    }

    clearPendingBoardNavigation();
    clickTimeoutRef.current = window.setTimeout(() => {
      router.push(boardHref);
    }, 220);
  }

  function handleDoubleClick() {
    if (!onPublish) {
      return;
    }

    clearPendingBoardNavigation();
    onPublish();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    clearPendingBoardNavigation();

    if (boardHref) {
      router.push(boardHref);
      return;
    }

    onPublish?.();
  }

  const content = (
    <>
      <span
        className={cn(
          "text-xs font-semibold tabular-nums sm:text-sm",
          isToday && "text-primary",
        )}
      >
        {dayNum}
      </span>

      <div className="flex items-center gap-1 sm:hidden">
        <span
          className={cn("block size-2 rounded-full", dotColor)}
          aria-hidden="true"
        />
        {exchangeDotColor && (
          <span
            className={cn("block size-2 rounded-full", exchangeDotColor)}
            aria-hidden="true"
          />
        )}
      </div>

      <span className="hidden text-[10px] font-medium leading-tight sm:block">
        {label}
      </span>

      {hasPublicationMarker && (
        <div className="flex items-center justify-center gap-1 sm:justify-start">
          {hasMyPublications && (
            <span
              className={cn(
                "block size-2 rounded-full ring-2 ring-background sm:size-2.5",
                CALENDAR_PUBLICATION_MARKER_DOT_COLORS.mine
              )}
              aria-hidden="true"
            />
          )}
          {hasOtherPublications && (
            <span
              className={cn(
                "block size-2 rounded-full ring-2 ring-background sm:size-2.5",
                CALENDAR_PUBLICATION_MARKER_DOT_COLORS.other
              )}
              aria-hidden="true"
            />
          )}
          <span className="sr-only">{publicationSummary}</span>
        </div>
      )}

      {exchangeOverlay && exchangeLabel && exchangeSummary && exchangeDotColor && (
        <div
          className={cn(
            "mt-auto hidden w-full rounded-lg border px-1.5 py-1 text-left sm:block",
            CALENDAR_EXCHANGE_OVERLAY_STYLES[exchangeOverlay.kind],
          )}
        >
          <div className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className={cn("size-1.5 rounded-full", exchangeDotColor)}
            />
            <span className="text-[9px] font-semibold leading-tight">
              {exchangeLabel}
            </span>
          </div>
          <span className="mt-0.5 block text-[9px] leading-tight">
            {exchangeSummary}
          </span>
        </div>
      )}

      {day.isOverride && (
        <>
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-500"
          />
          <span className="sr-only">Modificado por administrador</span>
        </>
      )}
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={className}
      aria-label={ariaLabel}
    >
      {content}
    </div>
  );
}
