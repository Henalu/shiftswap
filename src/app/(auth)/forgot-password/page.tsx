"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  sendPasswordResetEmail,
  type ForgotPasswordState,
} from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Enviando..." : "Enviar enlace de recuperacion"}
    </Button>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState<ForgotPasswordState, FormData>(
    sendPasswordResetEmail,
    {}
  );

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-3">
        <div className="space-y-2">
          <CardTitle>Recuperar contrasena</CardTitle>
          <CardDescription>
            Te enviaremos un enlace seguro para que puedas definir una nueva
            contrasena.
          </CardDescription>
        </div>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-5">
          {state.error ? (
            <p className="rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          {state.success ? (
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
              Si el email existe, acabamos de enviar el enlace de recuperacion.
              Revisa tu bandeja de entrada.
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email corporativo</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tu@empresa.com"
              required
              autoComplete="email"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <SubmitButton />
          <p className="text-center text-sm text-muted-foreground">
            Ya recuerdas tu contrasena?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Volver a iniciar sesion
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
