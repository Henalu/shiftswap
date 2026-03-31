import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LegalDocumentProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function LegalDocument({
  title,
  description,
  children,
}: LegalDocumentProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10">
      <Card className="w-full border-border/80">
        <CardHeader className="space-y-2">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-7 text-muted-foreground">
          {children}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-3">
          <Link
            href="/billing"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Volver a suscripcion
          </Link>
          <p className="text-sm text-muted-foreground">
            Revisa estos textos con apoyo legal antes de un lanzamiento publico.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
