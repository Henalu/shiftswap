"use client";

import { useActionState } from "react";
import Link from "next/link";
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
import { loginWithPassword, type LoginActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState<LoginActionState, FormData>(
    loginWithPassword,
    {}
  );

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-3">
        <div className="space-y-2">
          <CardTitle>Iniciar sesion</CardTitle>
          <CardDescription>
            Entra en tu espacio para revisar turnos, gestionar intercambios y
            seguir las conversaciones abiertas.
          </CardDescription>
        </div>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-6">
          {state.error ? (
            <p className="rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {state.error}
            </p>
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

          <div className="space-y-2">
            <Label htmlFor="password">Contrasena</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <SubmitButton />
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            He olvidado mi contraseña
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            Aun no tienes cuenta?{" "}
            <Link
              href="/register"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Solicita acceso
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
