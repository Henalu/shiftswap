import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ShiftForm } from "./shift-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function NewShiftPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("department_id")
    .eq("id", authUser.id)
    .single();

  if (!profile?.department_id) {
    redirect("/profile");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/shifts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Publicar nuevo turno
        </h1>
      </div>
      <ShiftForm
        departmentId={profile.department_id}
        userId={authUser.id}
      />
    </div>
  );
}
