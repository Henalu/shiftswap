import { LegalDocument } from "@/components/legal/legal-document";

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Politica de privacidad"
      description="Tratamiento base de datos personales y documentos dentro de ShiftSwap."
    >
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Datos tratados</h2>
        <p>
          El servicio trata datos de identificacion, contacto, adscripcion
          organizativa, actividad dentro de la app y, cuando procede, documentos de
          validacion del empleado.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Finalidad</h2>
        <p>
          Los datos se usan para validar cuentas, permitir el uso del producto,
          registrar operaciones internas y mantener trazabilidad del expediente.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Conservacion</h2>
        <p>
          Los documentos de validacion deben conservarse solo el tiempo necesario
          para la revision y la defensa minima del proceso, y revisarse con una
          politica de borrado documentada.
        </p>
      </section>
    </LegalDocument>
  );
}
