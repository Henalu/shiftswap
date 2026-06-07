export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(0.9_0.07_255_/_0.18),transparent_28rem)]" />
      <div className="relative z-10 grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="hidden rounded-[2rem] border border-border/80 bg-card/92 p-8 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_48px_-28px_rgba(15,23,42,0.24)] lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-6">
            <span className="inline-flex w-fit items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Producto interno
            </span>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-[-0.05em] text-foreground">
                ShiftSwap
              </h1>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Publica turnos, encuentra alternativas, negocia con contexto y
                avanza por el flujo de intercambio sin perder tiempo.
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/70 bg-secondary/50 p-5">
            <p className="text-sm font-semibold text-foreground">
              Pensado para uso diario
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>Comparacion clara de turnos y estados.</li>
              <li>Acciones rapidas para mostrar interes y negociar.</li>
              <li>Confirmacion y seguimiento sin complejidad innecesaria.</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-full max-w-lg space-y-5">
            <div className="space-y-2 text-center lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                ShiftSwap
              </p>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
                Intercambio de turnos
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                Accede y gestiona tus turnos con claridad y rapidez.
              </p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
