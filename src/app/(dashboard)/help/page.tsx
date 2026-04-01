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
      ],
    },
    {
      title: "Publicar y buscar turnos",
      items: [
        {
          question: "Como publico un turno?",
          answer:
            "Ve a Mis turnos y pulsa Publicar turno. Selecciona la fecha, el tipo de turno y las modalidades de compensacion que aceptas. El turno aparecera en el Tablon para que otros companeros puedan proponerte un cambio.",
        },
        {
          question: "Que son las modalidades de compensacion?",
          answer:
            "Cuando publicas un turno, eliges que tipo de compensacion aceptas: intercambio de turno (el companero te devuelve un turno en otra fecha) o bolsa de horas (queda registrada una deuda de turno a tu favor).",
        },
        {
          question: "Como propongo un cambio a otro companero?",
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
            "Firmar confirma que aceptas las condiciones del cambio. Tu firma digital (la que configuraste en el perfil) aparecera automaticamente en el documento oficial. Ambas partes deben firmar para que el expediente avance a validacion.",
        },
        {
          question: "Puedo cancelar un cambio ya aceptado?",
          answer:
            "Si, mientras no haya sido aprobado por el departamento. Si ya esta en validacion, puedes solicitar una retirada que la otra parte debe confirmar.",
        },
      ],
    },
    {
      title: "Chat y comunicacion",
      items: [
        {
          question: "Para que sirve el chat?",
          answer:
            "El chat te permite hablar directamente con el otro companero implicado en un cambio. Puedes coordinar detalles, resolver dudas o negociar condiciones antes de firmar.",
        },
        {
          question: "Cuando puedo usar el chat?",
          answer:
            "El chat esta disponible desde que se crea el expediente de cambio hasta que se resuelve (aprobado, rechazado o cancelado).",
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
            "Los documentos estan disponibles una vez que el expediente ha sido firmado por ambas partes y enviado a validacion.",
        },
      ],
    },
  ];
}

function getAdminSections(): HelpSection[] {
  return [
    {
      title: "Aprobaciones de cambios",
      items: [
        {
          question: "Como apruebo o rechazo un cambio?",
          answer:
            "Ve a Aprobaciones en el panel de administracion. Veras los expedientes pendientes de tu departamento. Revisa el detalle y pulsa Aprobar o Rechazar. Si rechazas, debes indicar el motivo.",
        },
        {
          question: "Puedo aprobar un cambio en el que participo?",
          answer:
            "No. Si eres parte del intercambio (como publicador o solicitante), la aprobacion debe resolverla otra persona con permisos en el departamento.",
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
      title: "Gestion de departamento",
      items: [
        {
          question: "Que son los cambios de departamento?",
          answer:
            "Cuando un empleado necesita trasladarse a otro departamento operativo, puede solicitarlo. Desde Cambios de depto. puedes revisar y resolver estas solicitudes.",
        },
        {
          question: "Que son los cambios de puesto?",
          answer:
            "Los empleados pueden solicitar un cambio de puesto dentro de su departamento. Desde Cambios de puesto puedes revisar y aprobar estas peticiones.",
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
      </div>
    </>
  );
}
