interface ExchangeApprovalDecisionFormProps {
  exchangeId: string;
  requesterName: string;
  ownerName: string;
}

export function ExchangeApprovalDecisionForm({
  exchangeId,
  requesterName,
  ownerName,
}: ExchangeApprovalDecisionFormProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
      <p className="text-sm font-semibold text-foreground">
        Responsable informado
      </p>
      <p className="text-sm leading-6 text-muted-foreground">
        {ownerName} y {requesterName} cierran este intercambio con sus firmas.
        No hay decision adicional del responsable para el expediente{" "}
        {exchangeId.slice(0, 8)}.
      </p>
    </div>
  );
}
