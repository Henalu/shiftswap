import { LegalDocument } from "@/components/legal/legal-document";

export default function DataProcessingPage() {
  return (
    <LegalDocument
      title="Tratamiento de documentos de empleado"
      description="Notas base sobre validacion, conservacion y acceso a documentacion sensible."
    >
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Acceso restringido</h2>
        <p>
          Los documentos de validacion solo deben estar disponibles para las
          personas administradoras autorizadas y durante el tiempo imprescindible.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Borrado</h2>
        <p>
          ShiftSwap ya elimina el carné almacenado cuando la solicitud de acceso se
          aprueba o se rechaza. Debe completarse con revisiones periodicas de
          solicitudes antiguas y con una politica documentada de retencion.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Revision legal</h2>
        <p>
          Este texto es una base tecnica y operativa. Antes de un lanzamiento
          publico o de cobro debe revisarse con asesoramiento legal y RGPD.
        </p>
      </section>
    </LegalDocument>
  );
}
