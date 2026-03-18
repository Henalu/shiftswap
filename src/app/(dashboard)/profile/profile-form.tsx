"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "./actions";
import type { UserProfile } from "@/types";

interface ProfileFormProps {
  profile: Pick<
    UserProfile,
    "full_name" | "email" | "phone" | "avatar_url" | "employee_id"
  >;
  companyName: string;
  departmentName: string;
  userId: string;
}

interface ReadonlyFieldProps {
  label: string;
  value: string;
}

function ReadonlyField({ label, value }: ReadonlyFieldProps) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-base text-foreground">{value}</p>
    </div>
  );
}

export function ProfileForm({
  profile,
  companyName,
  departmentName,
  userId,
}: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile.avatar_url ?? null
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

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar los 5 MB.");
      return;
    }

    setPendingFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: React.FormEvent) {
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
        <CardHeader>
          <CardTitle className="text-base">Foto de perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="size-20">
                <AvatarImage src={avatarPreview ?? undefined} alt={fullName} />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                aria-label="Cambiar foto de perfil"
              >
                <Camera className="size-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {pendingFile ? pendingFile.name : "Sube una foto de perfil"}
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WEBP o GIF · máx. 5 MB
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
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
        <CardHeader>
          <CardTitle className="text-base">Información personal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Label htmlFor="phone">Teléfono</Label>
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

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Información laboral</CardTitle>
          <Badge
            variant="secondary"
            className="w-fit border border-emerald-200 bg-emerald-50 text-emerald-700"
          >
            Cuenta verificada
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <ReadonlyField label="Empresa" value={companyName} />
          <ReadonlyField
            label="ID de empleado"
            value={profile.employee_id?.trim() || "No disponible"}
          />
          <ReadonlyField label="Departamento" value={departmentName} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
