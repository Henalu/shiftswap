export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          ShiftSwap
        </h1>
        <p className="text-sm text-muted-foreground">
          Intercambio de turnos entre empleados
        </p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
