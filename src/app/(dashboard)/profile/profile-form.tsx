"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  Camera,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/profile/signature-pad";
import { PANEL_CLASSNAME, cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "./actions";
import type { UserProfile } from "@/types";

interface ProfileFormProps {
  profile: Pick<
    UserProfile,
    "full_name" | "email" | "phone" | "avatar_url" | "signature_url"
  >;
  userId: string;
}

interface ReadonlyFieldProps {
  icon: ReactNode;
  label: string;
  value: string;
  className?: string;
}

function ReadonlyField({ icon, label, value, className }: ReadonlyFieldProps) {
  return (
    <div
      className={cn(
        PANEL_CLASSNAME,
        "flex h-full items-start gap-3 px-4 py-4",
        className
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
        {icon}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="break-words text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function ProfileForm({
  profile,
  userId,
}: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile.avatar_url ?? null
  );
  const [signatureUrl, setSignatureUrl] = useState<string | null>(
    profile.signature_url ?? null
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials =
    fullName
      .split(" ")
      .map((name) => name[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar los 5 MB.");
      return;
    }

    setPendingFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!fullName.trim()) {
      toast.error("El nombre completo es obligatorio.");
      return;
    }

    if (!email.trim()) {
      toast.error("El email de contacto es obligatorio.");
      return;
    }

    setSaving(true);
    let avatarUrl: string | undefined;

    if (pendingFile) {
      const ext = pendingFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/avatar.${ext}`;
      const supabase = createClient();

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, pendingFile, { upsert: true });

      if (uploadError) {
        toast.error("No se pudo subir la imagen: " + uploadError.message);
        setSaving(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      avatarUrl = `${publicUrl}?t=${Date.now()}`;
      setPendingFile(null);
    }

    const formData = new FormData();
    formData.set("full_name", fullName.trim());
    formData.set("phone", phone.trim());
    formData.set("email", email.trim());

    if (avatarUrl !== undefined) {
      formData.set("avatar_url", avatarUrl);
    }

    const result = await updateProfile(formData);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Perfil actualizado correctamente.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle>Foto de perfil</CardTitle>
              <CardDescription>
                Manten tu cuenta actualizada para que el resto del equipo te
                identifique rapido en turnos, chat e intercambios.
              </CardDescription>
            </div>
            <Badge className="w-fit border-emerald-500/15 bg-emerald-500/10 text-emerald-700">
              <ShieldCheck className="size-3.5" />
              Cuenta verificada
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative">
              <Avatar className="size-24 border border-border/70 shadow-sm">
                <AvatarImage src={avatarPreview ?? undefined} alt={fullName} />
                <AvatarFallback className="bg-secondary text-2xl font-semibold text-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                aria-label="Cambiar foto de perfil"
              >
                <Camera className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                {pendingFile ? pendingFile.name : "Sube una foto de perfil"}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Usa una imagen clara para facilitar reconocimiento en un flujo de
                trabajo rapido. JPG, PNG, WEBP o GIF hasta 5 MB.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Cambiar imagen
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-2">
          <CardTitle>Firma digital</CardTitle>
          <CardDescription>
            Tu firma se usara automaticamente en todos los documentos que firmes
            dentro de ShiftSwap. Configurarla es obligatorio para operar en la
            plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignaturePad
            userId={userId}
            currentSignatureUrl={signatureUrl}
            onSaved={setSignatureUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-2">
          <CardTitle>Informacion personal</CardTitle>
          <CardDescription>
            Actualiza los datos con los que el equipo te identifica y contacta
            dentro de ShiftSwap.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                placeholder="Tu nombre completo"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+34 600 000 000"
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email de contacto</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="tu@empresa.com"
              autoComplete="email"
            />
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="grid gap-4 pt-1 sm:grid-cols-2">
          <ReadonlyField
            icon={<Phone className="size-4" />}
            label="Canal de contacto"
            value={phone.trim() || "Sin telefono configurado"}
          />
          <ReadonlyField
            icon={<Mail className="size-4" />}
            label="Correo visible"
            value={email.trim() || "Sin email configurado"}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
