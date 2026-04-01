"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Eraser, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface SignaturePadProps {
  userId: string;
  currentSignatureUrl: string | null;
  onSaved: (url: string) => void;
}

interface Point {
  x: number;
  y: number;
}

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 200;
const LINE_WIDTH = 2.5;
const LINE_COLOR = "#1e293b";

function getPointerPosition(
  canvas: HTMLCanvasElement,
  event: MouseEvent | TouchEvent
): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  if ("touches" in event) {
    const touch = event.touches[0];
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  }

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

export function SignaturePad({
  userId,
  currentSignatureUrl,
  onSaved,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const hasStrokesRef = useRef(false);
  const [isEditing, setIsEditing] = useState(!currentSignatureUrl);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasStrokesRef.current = false;
  }, [isEditing]);

  function startStroke(event: React.MouseEvent | React.TouchEvent) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    isDrawingRef.current = true;
    lastPointRef.current = getPointerPosition(
      canvas,
      event.nativeEvent as MouseEvent | TouchEvent
    );
  }

  function continueStroke(event: React.MouseEvent | React.TouchEvent) {
    event.preventDefault();
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastPointRef.current) return;

    const point = getPointerPosition(
      canvas,
      event.nativeEvent as MouseEvent | TouchEvent
    );

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPointRef.current = point;
    hasStrokesRef.current = true;
  }

  function endStroke() {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasStrokesRef.current = false;
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!hasStrokesRef.current) {
      toast.error("Dibuja tu firma antes de guardar.");
      return;
    }

    setSaving(true);

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );

      if (!blob) {
        toast.error("No se pudo procesar la imagen de la firma.");
        setSaving(false);
        return;
      }

      const path = `${userId}/signature.png`;
      const supabase = createClient();

      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(path, blob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        toast.error("No se pudo subir la firma: " + uploadError.message);
        setSaving(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("signatures").getPublicUrl(path);

      const signatureUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ signature_url: signatureUrl })
        .eq("id", userId);

      if (updateError) {
        toast.error("No se pudo guardar la firma en tu perfil.");
        setSaving(false);
        return;
      }

      onSaved(signatureUrl);
      setIsEditing(false);
      toast.success("Firma guardada correctamente.");
    } catch {
      toast.error("Error inesperado al guardar la firma.");
    } finally {
      setSaving(false);
    }
  }

  if (!isEditing && currentSignatureUrl) {
    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
          <img
            src={currentSignatureUrl}
            alt="Tu firma digital"
            className="mx-auto block h-[120px] w-auto object-contain py-4"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Firma configurada. Se usara automaticamente al firmar documentos.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsEditing(true)}
          >
            <PenLine className="size-4" />
            Cambiar firma
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startStroke}
          onMouseMove={continueStroke}
          onMouseUp={endStroke}
          onMouseLeave={endStroke}
          onTouchStart={startStroke}
          onTouchMove={continueStroke}
          onTouchEnd={endStroke}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Dibuja tu firma con el raton o el dedo. Se guardara como imagen y se
        usara en todos los documentos que firmes dentro de la app.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Guardando..." : "Guardar firma"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={clearCanvas}
          disabled={saving}
        >
          <Eraser className="size-4" />
          Borrar
        </Button>
        {currentSignatureUrl && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsEditing(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
