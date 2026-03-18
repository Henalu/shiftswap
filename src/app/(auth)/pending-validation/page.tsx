import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>
          {isRejected ? "Cuenta rechazada" : "Cuenta pendiente de revisión"}
        </CardTitle>
        <CardDescription>
          {isRejected
            ? "Tu registro necesita correcciones antes de poder activarse."
            : "Tu solicitud ya está registrada y el equipo administrador la revisará manualmente."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>
          {isRejected
            ? "No puedes acceder todavía a ShiftSwap. Revisa la observación del administrador y contacta con tu empresa para repetir el proceso si hace falta."
            : "No podrás acceder al dashboard hasta que un administrador valide tu condición de empleado y active la cuenta."}
        </p>
        {isRejected && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
            <p className="font-medium">Motivo indicado por el administrador</p>
            <p className="mt-2 whitespace-pre-wrap">
              {accountState.validation_notes?.trim() ||
                "No se ha añadido ninguna observación adicional."}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Puedes volver más tarde para comprobar si el estado ha cambiado.
        </p>
        <LogoutButton />
      </CardFooter>
    </Card>
  );
}
