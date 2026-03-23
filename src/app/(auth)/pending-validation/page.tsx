import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import { LogoutButton } from "./logout-button";

export default async function PendingValidationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const accountState = await getAccountGateState(user.id);

  if (!accountState) {
    redirect("/profile?setup=1");
  }

  if (accountState.validation_status === "approved") {
    redirect("/shifts");
  }

  const isRejected = accountState.validation_status === "rejected";

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-3">
        <div className="space-y-2">
          <CardTitle>
            {isRejected ? "Cuenta rechazada" : "Cuenta pendiente de revision"}
          </CardTitle>
          <CardDescription>
            {isRejected
              ? "Tu registro necesita ajustes antes de poder activarse."
              : "Tu solicitud ya esta registrada y ahora debe revisarla un administrador."}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>
          {isRejected
            ? "No puedes acceder todavia a ShiftSwap. Revisa la observacion recibida y corrige la documentacion con tu empresa."
            : "Hasta que tu cuenta se valide, no podras entrar al dashboard. En cuanto se apruebe, podras iniciar sesion con normalidad."}
        </p>

        {isRejected && (
          <div className="rounded-2xl border border-destructive/15 bg-destructive/10 p-4 text-sm text-foreground">
            <p className="font-semibold">Motivo indicado por el administrador</p>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
              {accountState.validation_notes?.trim() ||
                "No se ha anadido ninguna observacion adicional."}
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-border/70 bg-secondary/45 p-4">
          <p className="text-sm font-semibold text-foreground">Que puedes hacer ahora</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Vuelve mas tarde para comprobar si el estado ha cambiado.</li>
            <li>Si tu solicitud fue rechazada, usa la observacion para corregirla.</li>
            <li>Si prefieres salir, puedes cerrar sesion y volver despues.</li>
          </ul>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href="/pending-validation">Comprobar de nuevo</Link>
        </Button>
        <LogoutButton />
      </CardFooter>
    </Card>
  );
}
