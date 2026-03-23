"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { createClient } from "@/lib/supabase/client";

function isRefreshTokenError(message: string | undefined): boolean {
  if (!message) return false;

  return (
    message.includes("Refresh Token") ||
    message.includes("refresh token") ||
    message.includes("JWT")
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    let { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError && isRefreshTokenError(signInError.message)) {
      await supabase.auth.signOut({ scope: "local" });

      const retryResult = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      signInError = retryResult.error;
    }

    setLoading(false);

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Email o contrasena incorrectos."
          : isRefreshTokenError(signInError.message)
            ? "La sesion anterior estaba caducada o dañada. Intenta entrar de nuevo."
          : signInError.message
      );
      return;
    }

    router.push("/shifts");
    router.refresh();
  }

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

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {error && (
            <p className="rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email corporativo</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contrasena</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
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
