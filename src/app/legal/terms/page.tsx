import { LegalDocument } from "@/components/legal/legal-document";

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terminos y condiciones"
      description="Base operativa para el uso de ShiftSwap durante pilotos y primeras implantaciones."
    >
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Uso del servicio</h2>
        <p>
          ShiftSwap es una aplicacion orientada a gestionar intercambio de turnos,
          validaciones y expedientes internos. El acceso debe usarse solo con fines
          laborales autorizados.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Cuentas y acceso</h2>
        <p>
          El registro no garantiza acceso inmediato. Cada cuenta puede quedar
          pendiente de validacion manual y el acceso puede suspenderse por
          incumplimiento operativo o comercial.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Disponibilidad</h2>
        <p>
          Durante el piloto y las primeras salidas comerciales, el servicio puede
          evolucionar, limitar funciones o realizar mantenimientos planificados.
        </p>
      </section>
    </LegalDocument>
  );
}
