import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccountGateState } from "@/lib/user-profiles";
import { hasAdminPanelAccess } from "@/lib/user-roles";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

interface HelpSection {
  title: string;
  items: { question: string; answer: string }[];
}

function getMemberSections(): HelpSection[] {
  return [
    {
      title: "Primeros pasos",
      items: [
        {
          question: "Como empiezo a usar ShiftSwap?",
          answer:
            "Tras registrarte y ser validado por tu empresa, configura tu firma digital en Mi perfil. La firma es obligatoria para publicar turnos, proponer cambios y firmar acuerdos.",
        },
        {
          question: "Donde configuro mi firma digital?",
          answer:
            "Ve a Mi perfil y busca la seccion Firma digital. Dibuja tu firma en el recuadro y pulsa Guardar. Solo necesitas hacerlo una vez.",
        },
        {
          question: "Donde cambio mi departamento, puesto o jornada?",
          answer:
            "Ve a Mi perfil y usa Configuracion laboral. Los cambios se guardan al momento y se aplican a tu calendario y a tu contexto de turnos.",
        },
      ],
    },
    {
      title: "Publicar y buscar turnos",
      items: [
        {
          question: "Como publico un turno?",
          answer:
            "Ve a Mis turnos y pulsa Publicar turno. Selecciona la fecha, el tipo de turno y las modalidades de compensacion que aceptas. El turno aparecera en el Tablon para que otros compañeros puedan proponerte un cambio.",
        },
        {
          question: "Que son las modalidades de compensacion?",
          answer:
            "Cuando publicas un turno, eliges que tipo de compensacion aceptas: intercambio de turno (el compañero te devuelve un turno en otra fecha) o bolsa de horas (queda registrada una deuda de turno a tu favor).",
        },
        {
          question: "Como propongo un cambio a otro compañero?",
          answer:
            "Busca el turno en el Tablon, abre su detalle y pulsa Proponer cambio. Elige la modalidad de compensacion y, si es intercambio, indica la fecha y turno que ofreces a cambio.",
        },
      ],
    },
    {
      title: "Negociacion y acuerdos",
      items: [
        {
          question: "Que pasa cuando alguien propone un cambio en mi turno?",
          answer:
            "Recibiras una notificacion. Ve a Mis turnos para ver las propuestas recibidas. Puedes aceptar una o rechazarlas. Al aceptar, se crea el expediente de cambio.",
        },
        {
          question: "Que significa firmar un acuerdo?",
          answer:
            "Firmar confirma que aceptas las condiciones del cambio. Tu firma digital (la que configuraste en el perfil) aparecera automaticamente en el documento oficial. Cuando ambas partes firman, el intercambio queda aceptado y el responsable queda informado.",
        },
        {
          question: "Puedo cancelar un cambio ya aceptado?",
          answer:
            "Si, antes de la primera fecha implicada. Si ya esta firmado por ambas partes, puedes solicitar una retirada que la otra parte debe confirmar.",
        },
      ],
    },
    {
      title: "Chat y comunicacion",
      items: [
        {
          question: "Para que sirve el chat?",
          answer:
            "El chat te permite hablar directamente con el otro compañero implicado en un cambio. Puedes coordinar detalles, resolver dudas o negociar condiciones antes de firmar.",
        },
        {
          question: "Cuando puedo usar el chat?",
          answer:
            "El chat esta disponible desde que se crea el expediente de cambio hasta que se cierra o se cancela.",
        },
      ],
    },
    {
      title: "Documentos y PDF",
      items: [
        {
          question: "Que documentos se generan?",
          answer:
            "ShiftSwap genera automaticamente dos documentos PDF: uno corporativo con el resumen del acuerdo y otro oficial (L-127) que replica el formulario interno de la empresa. Ambos incluyen las firmas digitales de los participantes.",
        },
        {
          question: "Cuando puedo descargar los PDF?",
          answer:
            "Los documentos estan disponibles una vez que el expediente ha sido firmado por ambas partes.",
        },
      ],
    },
  ];
}

function getAdminSections(): HelpSection[] {
  return [
    {
      title: "Cambios informados",
      items: [
        {
          question: "Que tengo que hacer cuando dos usuarios aceptan un cambio?",
          answer:
            "No tienes que aprobarlo. Ve a Cambios equipo en el panel de administracion para consultar los expedientes aceptados por ambas partes dentro de tu alcance.",
        },
        {
          question: "Puedo bloquear un cambio ya aceptado por ambas partes?",
          answer:
            "El flujo de intercambio se cierra con las dos firmas. El responsable queda informado para seguimiento operativo, no como paso de aprobacion.",
        },
      ],
    },
    {
      title: "Validacion de cuentas",
      items: [
        {
          question: "Que es la validacion de cuentas?",
          answer:
            "Cuando un empleado se registra, su cuenta queda pendiente de validacion. Desde Validaciones puedes revisar los datos, verificar su identidad y aprobar o rechazar el acceso.",
        },
      ],
    },
    {
      title: "Configuracion laboral",
      items: [
        {
          question: "Quien cambia ahora el departamento o puesto de un empleado?",
          answer:
            "Cada empleado puede actualizarlo desde Mi perfil. La administracion ya no tiene que aprobar esas modificaciones de perfil laboral.",
        },
        {
          question: "Quien asigna el grupo de rotacion?",
          answer:
            "El propio empleado puede elegir su tipo de jornada y su grupo de rotacion desde Configuracion laboral. El panel de calendarios sigue sirviendo para revisar la configuracion general del area.",
        },
      ],
    },
  ];
}

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const accountState = await getAccountGateState(authUser.id);
  const role: UserRole = accountState?.role ?? "member";
  const isAdmin = hasAdminPanelAccess(role);

  const memberSections = getMemberSections();
  const adminSections = isAdmin ? getAdminSections() : [];

  return (
    <>
      <PageHeader
        title="Ayuda"
        description="Resuelve tus dudas sobre como funciona ShiftSwap."
      />

      <div className="space-y-8">
        {memberSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-lg">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-5">
                {section.items.map((item) => (
                  <div key={item.question}>
                    <dt className="text-sm font-medium text-foreground">
                      {item.question}
                    </dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}

        {adminSections.length > 0 && (
          <>
            <div className="pt-2">
              <h2 className="text-lg font-semibold text-foreground">
                Administracion
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Estas secciones son visibles solo para usuarios con permisos de
                administracion.
              </p>
            </div>

            {adminSections.map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-5">
                    {section.items.map((item) => (
                      <div key={item.question}>
                        <dt className="text-sm font-medium text-foreground">
                          {item.question}
                        </dt>
                        <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {item.answer}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        <section className="scroll-mt-24" id="sugerencias">
          <SuggestionForm />
        </section>
      </div>
    </>
  );
}
