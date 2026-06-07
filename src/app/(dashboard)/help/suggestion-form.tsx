"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { Lightbulb, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitSuggestion } from "./actions";

const MIN_SUGGESTION_LENGTH = 10;
const MAX_SUGGESTION_LENGTH = 2000;

export function SuggestionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const trimmedLength = content.trim().length;
  const isTooShort =
    trimmedLength > 0 && trimmedLength < MIN_SUGGESTION_LENGTH;
  const canSubmit =
    trimmedLength >= MIN_SUGGESTION_LENGTH &&
    content.length <= MAX_SUGGESTION_LENGTH &&
    !isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      toast.error(`Escribe al menos ${MIN_SUGGESTION_LENGTH} caracteres.`);
      return;
    }

    const formData = new FormData(event.currentTarget);

    startTransition(() => {
      void submitSuggestion(formData)
        .then((result) => {
          if (result.error) {
            toast.error(result.error);
            return;
          }

          setContent("");
          formRef.current?.reset();

          if (result.emailStatus === "sent") {
            toast.success("Sugerencia enviada. Gracias por ayudar a mejorar ShiftSwap.");
            return;
          }

          toast.success(
            "Sugerencia guardada. Activaremos el correo final cuando este configurado."
          );
        })
        .catch(() => {
          toast.error("No se pudo enviar la sugerencia. Intentalo de nuevo.");
        });
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lightbulb className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <CardTitle>Sugerencias</CardTitle>
            <CardDescription>
              Cuentanos que mejorarias o que echas en falta. Puedes enviar una
              sugerencia al dia.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form ref={formRef} className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="suggestion-content">Tu sugerencia</Label>
            <Textarea
              id="suggestion-content"
              name="content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Ejemplo: me ayudaria poder filtrar turnos por..."
              maxLength={MAX_SUGGESTION_LENGTH}
              disabled={isPending}
              aria-describedby="suggestion-help suggestion-count"
              aria-invalid={isTooShort}
              className="min-h-36 resize-y"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <p
                id="suggestion-help"
                className={isTooShort ? "text-destructive" : undefined}
              >
                {isTooShort
                  ? `Minimo ${MIN_SUGGESTION_LENGTH} caracteres.`
                  : "Una sugerencia al dia para mantenerlo accionable."}
              </p>
              <span id="suggestion-count" aria-live="polite">
                {content.length}/{MAX_SUGGESTION_LENGTH}
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit}>
              <Send className="size-4" aria-hidden="true" />
              {isPending ? "Enviando..." : "Enviar sugerencia"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
