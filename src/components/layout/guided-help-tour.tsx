"use client";

import type { CSSProperties } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleHelp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasAdminPanelAccess } from "@/lib/user-roles";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

const STORAGE_KEY = "shiftswap_guided_help_seen_v1";
const OPEN_EVENT = "shiftswap:guided-help-open";
const SPOTLIGHT_PADDING = 8;
const TARGET_GAP = 12;
const VIEWPORT_MARGIN = 16;
const MOBILE_BREAKPOINT = 640;

type PreferredPlacement = "top" | "bottom" | "left" | "right" | "center";

type TourStep = {
  adminOnly?: boolean;
  description: string;
  fallbackTarget?: string;
  id: string;
  preferredPlacement: PreferredPlacement;
  route?: string;
  target: string;
  title: string;
};

const steps = [
  {
    id: "home",
    target: '[data-tour="nav-home"]',
    title: "Inicio",
    description:
      "Tu resumen operativo: calendario de hoy, prioridades, cambios activos y accesos rapidos.",
    preferredPlacement: "right",
  },
  {
    id: "board",
    target: '[data-tour="nav-shifts"]',
    title: "Tablon",
    description:
      "Aqui ves publicaciones abiertas de tu alcance y filtras por fecha o modalidad.",
    preferredPlacement: "right",
  },
  {
    id: "my-shifts",
    target: '[data-tour="nav-my-shifts"]',
    fallbackTarget: '[data-tour="nav-shifts"]',
    title: "Mis turnos",
    description:
      "Aqui controlas lo que has publicado, las solicitudes recibidas y tus propuestas enviadas.",
    preferredPlacement: "right",
  },
  {
    id: "calendar",
    target: '[data-tour="nav-calendar"]',
    title: "Calendario",
    description:
      "Tu calendario marca turnos, vacaciones, publicaciones y cambios aceptados.",
    preferredPlacement: "right",
  },
  {
    id: "chat",
    target: '[data-tour="nav-chat"]',
    title: "Chat",
    description:
      "Desde aqui puedes hablar con companeros y enviar propuestas directas sin pasar por el tablon.",
    preferredPlacement: "right",
  },
  {
    id: "exchanges",
    target: '[data-tour="nav-exchanges"]',
    title: "Cambios",
    description:
      "Aqui viven los expedientes: firmas, documentos y estado formal de cada acuerdo.",
    preferredPlacement: "right",
  },
  {
    id: "hours-bank",
    target: '[data-tour="nav-hours-bank"]',
    fallbackTarget: '[data-tour="nav-exchanges"]',
    title: "Bolsa de horas",
    description:
      "Consulta las horas acumuladas con cada persona y abre chat desde el saldo pendiente.",
    preferredPlacement: "right",
  },
  {
    id: "admin",
    adminOnly: true,
    target: '[data-tour="nav-admin"]',
    fallbackTarget: '[data-tour="nav-help"]',
    title: "Administracion",
    description:
      "Si tienes permisos, aqui revisas validaciones, calendarios, usuarios y cambios informados del equipo.",
    preferredPlacement: "right",
  },
  {
    id: "home-summary",
    route: "/home",
    target: '[data-tour="home-summary"]',
    title: "Resumen rapido",
    description:
      "Estos indicadores te dicen que hay que mirar hoy antes de entrar al detalle.",
    preferredPlacement: "bottom",
  },
  {
    id: "priorities",
    route: "/home",
    target: '[data-tour="home-priorities"]',
    title: "Prioridades",
    description:
      "Cuando hay firmas, propuestas o avisos urgentes, este bloque los sube arriba.",
    preferredPlacement: "right",
  },
  {
    id: "home-shifts",
    route: "/home",
    target: '[data-tour="home-open-shifts"]',
    fallbackTarget: '[data-tour="home-priorities"]',
    title: "Turnos para revisar",
    description:
      "Una muestra de publicaciones abiertas para decidir rapido si quieres entrar al tablon.",
    preferredPlacement: "right",
  },
  {
    id: "home-movements",
    route: "/home",
    target: '[data-tour="home-movements"]',
    fallbackTarget: '[data-tour="home-priorities"]',
    title: "Mis movimientos",
    description:
      "Tu actividad reciente: publicaciones, solicitudes enviadas y cambios activos.",
    preferredPlacement: "top",
  },
  {
    id: "home-quick-actions",
    route: "/home",
    target: '[data-tour="home-quick-actions"]',
    fallbackTarget: '[data-tour="home-agenda"]',
    title: "Accesos rapidos",
    description:
      "Atajos para publicar, revisar el tablon, abrir el chat o consultar tu perfil.",
    preferredPlacement: "left",
  },
] satisfies TourStep[];

type ViewportSize = {
  height: number;
  width: number;
};

type Rect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type TooltipPlacement = PreferredPlacement | "sheet";

type TourLayout = {
  fallback: boolean;
  placement: TooltipPlacement;
  spotlightRect: Rect | null;
  tooltipStyle: CSSProperties;
};

const defaultTooltipSize: ViewportSize = {
  height: 260,
  width: 360,
};

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function rectFromDomRect(rect: DOMRect): Rect {
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}

function getViewportSize(): ViewportSize {
  return {
    height: window.innerHeight,
    width: window.innerWidth,
  };
}

function getTooltipSize(size: ViewportSize, viewport: ViewportSize) {
  return {
    height: Math.min(
      Math.max(size.height || defaultTooltipSize.height, 180),
      Math.max(180, viewport.height - VIEWPORT_MARGIN * 2),
    ),
    width: Math.min(
      Math.max(size.width || defaultTooltipSize.width, 280),
      Math.max(280, viewport.width - VIEWPORT_MARGIN * 2),
    ),
  };
}

function getCenteredTooltipStyle(
  viewport: ViewportSize,
  tooltipSize: ViewportSize,
): CSSProperties {
  return {
    left: clamp(
      (viewport.width - tooltipSize.width) / 2,
      VIEWPORT_MARGIN,
      viewport.width - tooltipSize.width - VIEWPORT_MARGIN,
    ),
    top: clamp(
      (viewport.height - tooltipSize.height) / 2,
      VIEWPORT_MARGIN,
      viewport.height - tooltipSize.height - VIEWPORT_MARGIN,
    ),
  };
}

function getSheetTooltipStyle(): CSSProperties {
  return {
    bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
    left: "0.75rem",
    right: "0.75rem",
    top: "auto",
  };
}

function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

function hasSeenTour() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function clearSeenTour() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The launch event still opens the guide if storage is unavailable.
  }
}

function isElementMeasurable(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden"
  );
}

function getTourTarget(selector: string) {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
      isElementMeasurable,
    ) ?? null
  );
}

function getTourTargetForStep(step: TourStep) {
  return (
    getTourTarget(step.target) ??
    (step.fallbackTarget ? getTourTarget(step.fallbackTarget) : null)
  );
}

function getSpotlightRect(rect: Rect, viewport: ViewportSize): Rect | null {
  const top = clamp(
    rect.top - SPOTLIGHT_PADDING,
    VIEWPORT_MARGIN / 2,
    viewport.height - VIEWPORT_MARGIN / 2,
  );
  const left = clamp(
    rect.left - SPOTLIGHT_PADDING,
    VIEWPORT_MARGIN / 2,
    viewport.width - VIEWPORT_MARGIN / 2,
  );
  const right = clamp(
    rect.right + SPOTLIGHT_PADDING,
    VIEWPORT_MARGIN / 2,
    viewport.width - VIEWPORT_MARGIN / 2,
  );
  const bottom = clamp(
    rect.bottom + SPOTLIGHT_PADDING,
    VIEWPORT_MARGIN / 2,
    viewport.height - VIEWPORT_MARGIN / 2,
  );

  if (right - left < 4 || bottom - top < 4) {
    return null;
  }

  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

function getPlacementOrder(preferredPlacement: PreferredPlacement) {
  const fallbackOrder: PreferredPlacement[] = [
    "bottom",
    "top",
    "right",
    "left",
  ];

  if (preferredPlacement === "center") {
    return fallbackOrder;
  }

  return [
    preferredPlacement,
    ...fallbackOrder.filter((placement) => placement !== preferredPlacement),
  ];
}

function placementFits({
  placement,
  rect,
  tooltipSize,
  viewport,
}: {
  placement: PreferredPlacement;
  rect: Rect;
  tooltipSize: ViewportSize;
  viewport: ViewportSize;
}) {
  if (placement === "center") {
    return true;
  }

  if (placement === "top") {
    return rect.top >= tooltipSize.height + TARGET_GAP + VIEWPORT_MARGIN;
  }

  if (placement === "bottom") {
    return (
      viewport.height - rect.bottom >=
      tooltipSize.height + TARGET_GAP + VIEWPORT_MARGIN
    );
  }

  if (placement === "left") {
    return rect.left >= tooltipSize.width + TARGET_GAP + VIEWPORT_MARGIN;
  }

  return (
    viewport.width - rect.right >=
    tooltipSize.width + TARGET_GAP + VIEWPORT_MARGIN
  );
}

function getBestFallbackPlacement(rect: Rect, viewport: ViewportSize) {
  const spaces = [
    { placement: "bottom" as const, size: viewport.height - rect.bottom },
    { placement: "top" as const, size: rect.top },
    { placement: "right" as const, size: viewport.width - rect.right },
    { placement: "left" as const, size: rect.left },
  ];

  return spaces.sort((first, second) => second.size - first.size)[0].placement;
}

function getTooltipStyleForPlacement({
  placement,
  rect,
  tooltipSize,
  viewport,
}: {
  placement: PreferredPlacement;
  rect: Rect;
  tooltipSize: ViewportSize;
  viewport: ViewportSize;
}): CSSProperties {
  if (placement === "center") {
    return getCenteredTooltipStyle(viewport, tooltipSize);
  }

  if (placement === "top" || placement === "bottom") {
    return {
      left: clamp(
        rect.left + rect.width / 2 - tooltipSize.width / 2,
        VIEWPORT_MARGIN,
        viewport.width - tooltipSize.width - VIEWPORT_MARGIN,
      ),
      top:
        placement === "top"
          ? clamp(
              rect.top - TARGET_GAP - tooltipSize.height,
              VIEWPORT_MARGIN,
              viewport.height - tooltipSize.height - VIEWPORT_MARGIN,
            )
          : clamp(
              rect.bottom + TARGET_GAP,
              VIEWPORT_MARGIN,
              viewport.height - tooltipSize.height - VIEWPORT_MARGIN,
            ),
    };
  }

  return {
    left:
      placement === "left"
        ? clamp(
            rect.left - TARGET_GAP - tooltipSize.width,
            VIEWPORT_MARGIN,
            viewport.width - tooltipSize.width - VIEWPORT_MARGIN,
          )
        : clamp(
            rect.right + TARGET_GAP,
            VIEWPORT_MARGIN,
            viewport.width - tooltipSize.width - VIEWPORT_MARGIN,
          ),
    top: clamp(
      rect.top + rect.height / 2 - tooltipSize.height / 2,
      VIEWPORT_MARGIN,
      viewport.height - tooltipSize.height - VIEWPORT_MARGIN,
    ),
  };
}

function buildFallbackLayout(
  viewport: ViewportSize,
  rawTooltipSize: ViewportSize,
): TourLayout {
  const tooltipSize = getTooltipSize(rawTooltipSize, viewport);

  return {
    fallback: true,
    placement: "center",
    spotlightRect: null,
    tooltipStyle: getCenteredTooltipStyle(viewport, tooltipSize),
  };
}

function buildTourLayout({
  rawTooltipSize,
  step,
  target,
  viewport,
}: {
  rawTooltipSize: ViewportSize;
  step: TourStep;
  target: HTMLElement | null;
  viewport: ViewportSize;
}): TourLayout {
  if (!target) {
    return buildFallbackLayout(viewport, rawTooltipSize);
  }

  const targetRect = rectFromDomRect(target.getBoundingClientRect());
  const isInViewport =
    targetRect.bottom > 0 &&
    targetRect.right > 0 &&
    targetRect.top < viewport.height &&
    targetRect.left < viewport.width;

  if (!isInViewport) {
    return buildFallbackLayout(viewport, rawTooltipSize);
  }

  const spotlightRect = getSpotlightRect(targetRect, viewport);

  if (!spotlightRect) {
    return buildFallbackLayout(viewport, rawTooltipSize);
  }

  const tooltipSize = getTooltipSize(rawTooltipSize, viewport);
  const placement = getPlacementOrder(step.preferredPlacement).find((item) =>
    placementFits({ placement: item, rect: spotlightRect, tooltipSize, viewport }),
  );

  if (!placement && viewport.width < MOBILE_BREAKPOINT) {
    return {
      fallback: false,
      placement: "sheet",
      spotlightRect,
      tooltipStyle: getSheetTooltipStyle(),
    };
  }

  const resolvedPlacement =
    placement ?? getBestFallbackPlacement(spotlightRect, viewport);

  return {
    fallback: false,
    placement: resolvedPlacement,
    spotlightRect,
    tooltipStyle: getTooltipStyleForPlacement({
      placement: resolvedPlacement,
      rect: spotlightRect,
      tooltipSize,
      viewport,
    }),
  };
}

function OverlayPanels({ spotlightRect }: { spotlightRect: Rect | null }) {
  const panelClassName =
    "fixed bg-foreground/40 backdrop-blur-sm transition-all duration-150";

  if (!spotlightRect) {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-foreground/40 backdrop-blur-sm"
      />
    );
  }

  return (
    <>
      <div
        aria-hidden="true"
        className={panelClassName}
        style={{
          bottom: `calc(100dvh - ${spotlightRect.top}px)`,
          left: 0,
          right: 0,
          top: 0,
        }}
      />
      <div
        aria-hidden="true"
        className={panelClassName}
        style={{
          bottom: 0,
          left: 0,
          right: 0,
          top: spotlightRect.bottom,
        }}
      />
      <div
        aria-hidden="true"
        className={panelClassName}
        style={{
          height: spotlightRect.height,
          left: 0,
          top: spotlightRect.top,
          width: spotlightRect.left,
        }}
      />
      <div
        aria-hidden="true"
        className={panelClassName}
        style={{
          height: spotlightRect.height,
          left: spotlightRect.right,
          right: 0,
          top: spotlightRect.top,
        }}
      />
    </>
  );
}

function Spotlight({ rect }: { rect: Rect | null }) {
  if (!rect) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-10 rounded-xl border-2 border-background ring-4 ring-primary/70 shadow-lg transition-all duration-150"
      data-tour-spotlight=""
      style={{
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width,
      }}
    />
  );
}

function TooltipPointer({
  hidden,
  placement,
}: {
  hidden: boolean;
  placement: TooltipPlacement;
}) {
  if (hidden || placement === "center" || placement === "sheet") {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute size-3 rotate-45 border border-border bg-card",
        placement === "top" &&
          "bottom-[-0.4rem] left-1/2 -translate-x-1/2 border-l-0 border-t-0",
        placement === "bottom" &&
          "left-1/2 top-[-0.4rem] -translate-x-1/2 border-b-0 border-r-0",
        placement === "left" &&
          "right-[-0.4rem] top-1/2 -translate-y-1/2 border-b-0 border-l-0",
        placement === "right" &&
          "left-[-0.4rem] top-1/2 -translate-y-1/2 border-r-0 border-t-0",
      )}
    />
  );
}

interface GuidedHelpTourProps {
  autoStart?: boolean;
  role: UserRole;
}

export function GuidedHelpTour({
  autoStart = true,
  role,
}: GuidedHelpTourProps) {
  const descriptionId = useId();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tooltipSize, setTooltipSize] =
    useState<ViewportSize>(defaultTooltipSize);
  const [layout, setLayout] = useState<TourLayout | null>(null);
  const visibleSteps = useMemo(
    () =>
      steps.filter(
        (candidate) => !candidate.adminOnly || hasAdminPanelAccess(role),
      ),
    [role],
  );
  const safeStepIndex = Math.min(stepIndex, visibleSteps.length - 1);
  const step = visibleSteps[safeStepIndex] ?? steps[0];

  const updateLayout = useCallback(() => {
    if (!open) {
      return;
    }

    if (step.route && pathname !== step.route) {
      return;
    }

    setLayout(
      buildTourLayout({
        rawTooltipSize: tooltipSize,
        step,
        target: getTourTargetForStep(step),
        viewport: getViewportSize(),
      }),
    );
  }, [open, pathname, step, tooltipSize]);

  useEffect(() => {
    let initialOpenTimer: number | undefined;

    if (autoStart && !hasSeenTour()) {
      initialOpenTimer = window.setTimeout(() => setOpen(true), 0);
    }

    function openTour() {
      setStepIndex(0);
      setLayout(null);
      setOpen(true);
    }

    window.addEventListener(OPEN_EVENT, openTour);

    return () => {
      if (initialOpenTimer) {
        window.clearTimeout(initialOpenTimer);
      }
      window.removeEventListener(OPEN_EVENT, openTour);
    };
  }, [autoStart]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        markSeen();
        setLayout(null);
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    dialogRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (step.route && pathname !== step.route) {
      return;
    }

    let frameId = 0;
    const timers: number[] = [];

    function syncTargetLayout() {
      const target = getTourTargetForStep(step);

      target?.scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "center",
      });

      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateLayout);
    }

    syncTargetLayout();

    for (const delay of [120, 300, 700, 1100]) {
      timers.push(window.setTimeout(syncTargetLayout, delay));
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [open, pathname, step, updateLayout]);

  useEffect(() => {
    if (!open || !step.route || pathname === step.route) {
      return;
    }

    router.push(step.route);
  }, [open, pathname, router, step.route]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let frameId = 0;

    function scheduleUpdate() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateLayout);
    }

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [open, updateLayout]);

  useEffect(() => {
    if (!open || !tooltipRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const nextSize = {
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      };

      setTooltipSize((current) =>
        Math.abs(current.height - nextSize.height) > 1 ||
        Math.abs(current.width - nextSize.width) > 1
          ? nextSize
          : current,
      );
    });

    observer.observe(tooltipRef.current);

    return () => observer.disconnect();
  }, [open]);

  if (!open) {
    return null;
  }

  function closeTour() {
    markSeen();
    setLayout(null);
    setOpen(false);
  }

  function nextStep() {
    if (safeStepIndex === visibleSteps.length - 1) {
      closeTour();
      return;
    }

    setLayout(null);
    setStepIndex(safeStepIndex + 1);
  }

  function previousStep() {
    setLayout(null);
    setStepIndex(Math.max(0, safeStepIndex - 1));
  }

  const currentLayout =
    layout ?? buildFallbackLayout(getViewportSize(), tooltipSize);
  const isSheet = currentLayout.placement === "sheet";
  const progress = `${((safeStepIndex + 1) / visibleSteps.length) * 100}%`;

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-[70]"
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
    >
      <OverlayPanels spotlightRect={currentLayout.spotlightRect} />
      <Spotlight rect={currentLayout.spotlightRect} />

      <div
        className={cn(
          "fixed z-20 max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),24rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-xl outline-none transition-[left,top,bottom,right] duration-150 sm:p-5",
          currentLayout.fallback && "transition-none",
          isSheet && "w-auto rounded-b-2xl rounded-t-[1.35rem]",
        )}
        data-tour-fallback={currentLayout.fallback ? "true" : "false"}
        data-tour-placement={currentLayout.placement}
        data-tour-tooltip=""
        ref={tooltipRef}
        style={currentLayout.tooltipStyle}
      >
        <TooltipPointer
          hidden={currentLayout.fallback}
          placement={currentLayout.placement}
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Paso {safeStepIndex + 1} de {visibleSteps.length}
            </p>
            <h2
              className="mt-1 text-lg font-semibold tracking-[-0.02em]"
              id={titleId}
            >
              {step.title}
            </h2>
          </div>
          <Button
            aria-label="Cerrar guia"
            onClick={closeTour}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <p
          className="mt-4 text-sm leading-6 text-muted-foreground"
          id={descriptionId}
        >
          {step.description}
        </p>

        <div
          aria-hidden="true"
          className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150"
            style={{ width: progress }}
          />
        </div>

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <Button onClick={closeTour} type="button" variant="ghost">
            Saltar
          </Button>
          <div className="flex gap-2">
            <Button
              disabled={safeStepIndex === 0}
              onClick={previousStep}
              type="button"
              variant="outline"
            >
              Anterior
            </Button>
            <Button onClick={nextStep} type="button">
              {safeStepIndex === visibleSteps.length - 1
                ? "Terminar"
                : "Siguiente"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuidedHelpLaunchButton({
  className,
  label = "Guia",
  onLaunch,
}: {
  className?: string;
  label?: string;
  onLaunch?: () => void;
}) {
  function openTour() {
    clearSeenTour();
    window.dispatchEvent(new Event(OPEN_EVENT));
    onLaunch?.();
  }

  return (
    <Button
      className={className}
      data-tour="help-launcher"
      onClick={openTour}
      type="button"
      variant="outline"
    >
      <CircleHelp aria-hidden="true" />
      {label}
    </Button>
  );
}
