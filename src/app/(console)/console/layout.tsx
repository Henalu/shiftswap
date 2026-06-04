import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default function ConsoleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-muted/35 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex min-h-16 w-full max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            className="flex min-w-0 items-center gap-3 rounded-xl outline-none transition-colors focus-visible:ring-4 focus-visible:ring-primary/15"
            href="/console"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
              S
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold tracking-[-0.02em]">
                ShiftSwap Console
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Operaciones de plataforma
              </span>
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/home">
                <ArrowLeft className="size-4" />
                App
              </Link>
            </Button>
            <Button asChild className="hidden sm:inline-flex" size="sm" variant="outline">
              <Link href="/console">
                <ShieldCheck className="size-4" />
                Console
              </Link>
            </Button>
            <form action={signOut}>
              <Button aria-label="Cerrar sesion" size="icon" type="submit" variant="outline">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 md:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
