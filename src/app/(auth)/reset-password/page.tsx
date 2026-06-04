import Link from "next/link";
import { KeyRound } from "lucide-react";
import { updatePassword } from "@/app/(auth)/reset-password/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";

interface ResetPasswordPageProps {
  searchParams: Promise<{
    error?: string;
    reason?: string;
  }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hasSession = Boolean(user);
  const isTemporaryPassword = params.reason === "temporary-password";

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="size-5" />
        </div>
        <div className="space-y-2">
          <CardTitle>Definir nueva contrasena</CardTitle>
          <CardDescription>
            {isTemporaryPassword
              ? "Tu acceso usa una contrasena temporal. Cambiala antes de entrar."
              : "Crea una contrasena nueva para volver a entrar con seguridad."}
          </CardDescription>
        </div>
      </CardHeader>

      <form action={updatePassword}>
        <CardContent className="space-y-5">
          {params.error ? (
            <p className="rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {params.error}
            </p>
          ) : null}

          {!hasSession ? (
            <div className="rounded-2xl border border-border/70 bg-secondary/45 px-4 py-3 text-sm text-muted-foreground">
              Abre esta pantalla desde el enlace de recuperacion o vuelve a
              iniciar sesion con tu contrasena temporal.
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="password">Nueva contrasena</Label>
            <Input
              autoComplete="new-password"
              disabled={!hasSession}
              id="password"
              minLength={8}
              name="password"
              required
              type="password"
            />
            <p className="text-xs text-muted-foreground">
              Minimo 8 caracteres, con al menos una letra y un numero.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Repite la contrasena</Label>
            <Input
              autoComplete="new-password"
              disabled={!hasSession}
              id="confirmPassword"
              minLength={8}
              name="confirmPassword"
              required
              type="password"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button className="w-full" disabled={!hasSession} type="submit">
            Actualizar contrasena
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Prefieres volver al acceso normal?{" "}
            <Link
              className="font-medium text-primary underline-offset-4 hover:underline"
              href="/login"
            >
              Ir al login
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
