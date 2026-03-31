import { LegalDocument } from "@/components/legal/legal-document";

export default function BillingTermsPage() {
  return (
    <LegalDocument
      title="Politica de facturacion y cancelacion"
      description="Resumen operativo para el cobro recurrente y la gestion de suscripciones."
    >
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Suscripcion</h2>
        <p>
          El acceso de pago puede funcionar por usuario o por empresa segun el
          modelo comercial activo en cada momento.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Renovacion y cobro</h2>
        <p>
          Las renovaciones, cobros, fallos de pago y recibos se gestionan a traves
          del proveedor de billing configurado para el entorno productivo.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Cancelacion</h2>
        <p>
          La cancelacion debe especificar si produce baja inmediata o al final del
          periodo ya pagado. Esa regla debe reflejarse tambien en el customer
          portal y en la documentacion comercial.
        </p>
      </section>
    </LegalDocument>
  );
}
