"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Camera, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "./actions";
import type { UserProfile, Department } from "@/types";

interface ProfileFormProps {
  profile: UserProfile | null;
  departments: Department[];
  userId: string;
  userEmail: string;
  showSetupBanner?: boolean;
}

export function ProfileForm({
  profile,
  departments,
  userId,
  userEmail,
  showSetupBanner = false,
}: ProfileFormProps) {
  const isNew = profile === null;

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [departmentId, setDepartmentId] = useState(
    profile?.department_id ?? departments[0]?.id ?? ""
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile?.avatar_url ?? null
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials =
    fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar los 5 MB.");
      return;
    }

    setPendingFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("El nombre completo es obligatorio.");
      return;
    }
    if (!departmentId) {
      toast.error("Selecciona un departamento.");
      return;
    }

    setSaving(true);
    let avatarUrl: string | undefined;

    // Upload avatar to Supabase Storage if a new file was selected
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

      // Append timestamp to bust CDN cache after re-upload
      avatarUrl = `${publicUrl}?t=${Date.now()}`;
      setPendingFile(null);
    }

    const formData = new FormData();
    formData.set("full_name", fullName.trim());
    formData.set("phone", phone.trim());
    formData.set("department_id", departmentId);
    if (avatarUrl !== undefined) {
      formData.set("avatar_url", avatarUrl);
    }

    const result = await updateProfile(formData);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        isNew ? "Perfil creado correctamente." : "Perfil actualizado correctamente."
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contextual banner */}
      {(isNew || showSetupBanner) && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
            showSetupBanner
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            {showSetupBanner
              ? "Para publicar turnos necesitas completar tu perfil con tu nombre y departamento."
              : "Completa tu perfil para poder publicar y gestionar turnos."}
          </p>
        </div>
      )}

      {/* Avatar */}
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

      {/* Personal info */}
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
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Tu nombre completo"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                Email{" "}
                <span className="text-xs text-muted-foreground">
                  (solo lectura)
                </span>
              </Label>
              <Input
                id="email"
                value={userEmail}
                readOnly
                disabled
                autoComplete="email"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono (opcional)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department_id">Departamento</Label>
              <select
                id="department_id"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                required
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none ring-ring/50 transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              >
                {departments.length === 0 && (
                  <option value="" disabled>
                    Sin departamentos disponibles
                  </option>
                )}
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {saving
            ? "Guardando..."
            : isNew
            ? "Crear perfil"
            : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
