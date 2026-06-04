import Link from "next/link";
import { ArrowLeftRight, Check, Clock, X } from "lucide-react";
import {
  acceptDirectProposal,
  rejectDirectProposal,
} from "@/app/(dashboard)/chat/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EXCHANGE_AGREEMENT_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_STYLES,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPE_STYLES,
} from "@/lib/constants";
import { formatCompensationDateLabel } from "@/lib/exchange-compensation";
import { formatShortDate, formatTimeRange } from "@/lib/utils";
import type {
  RequestStatus,
  ShiftStatus,
  ShiftType,
} from "@/types";
import { DirectProposalDialog } from "./direct-proposal-dialog";
import type { CalendarDay } from "@/lib/calendar";

export interface DirectChatProposal {
  id: string;
  user_id: string;
  direct_recipient_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  status: string;
  description: string | null;
  request: {
    id: string;
    status: string;
    agreement_type: string | null;
    compensation_shift_date: string | null;
    compensation_shift_type: string | null;
  } | null;
  exchangeId?: string | null;
}

interface DirectProposalsPanelProps {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  calendarDays?: CalendarDay[] | null;
  proposals: DirectChatProposal[];
}

function getProposalSummary(proposal: DirectChatProposal) {
  const request = proposal.request;
  if (!request?.agreement_type) {
    return "Propuesta pendiente de completar.";
  }

  if (request.agreement_type === "hours_bank") {
    return EXCHANGE_AGREEMENT_LABELS.hours_bank;
  }

  const compensationLabel = request.compensation_shift_type
    ? SHIFT_TYPE_LABELS[request.compensation_shift_type as ShiftType]
    : "Turno pendiente";
  const dateLabel =
    formatCompensationDateLabel(request.compensation_shift_date) ??
    "fecha pendiente";

  return `${EXCHANGE_AGREEMENT_LABELS.shift_exchange}: ${compensationLabel} del ${dateLabel}`;
}

export function DirectProposalsPanel({
  conversationId,
  currentUserId,
  otherUserId,
  otherUserName,
  calendarDays,
  proposals,
}: DirectProposalsPanelProps) {
  const visibleProposals = proposals.slice(0, 4);

  return (
    <section className="space-y-4 rounded-[1.75rem] border border-border/80 bg-card/96 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_20px_40px_-28px_rgba(15,23,42,0.18)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ArrowLeftRight className="size-4 text-primary" />
            Propuestas directas
          </div>
          <p className="text-sm text-muted-foreground">
            Propuestas privadas entre esta conversacion y el flujo formal.
          </p>
        </div>
        <DirectProposalDialog
          conversationId={conversationId}
          recipientId={otherUserId}
          recipientName={otherUserName}
          calendarDays={calendarDays}
        />
      </div>

      {visibleProposals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/80 bg-secondary/35 px-4 py-5 text-sm text-muted-foreground">
          Aun no hay propuestas directas con esta persona.
        </p>
      ) : (
        <ul className="space-y-3">
          {visibleProposals.map((proposal) => {
            const isRecipient = proposal.direct_recipient_id === currentUserId;
            const isPending =
              proposal.status === "open" && proposal.request?.status === "pending";
            const timeRange = formatTimeRange(
              proposal.start_time,
              proposal.end_time,
            );
            const statusClassName = proposal.request
              ? REQUEST_STATUS_STYLES[proposal.request.status as RequestStatus]
              : SHIFT_STATUS_STYLES[proposal.status as ShiftStatus];
            const statusLabel = proposal.request
              ? REQUEST_STATUS_LABELS[proposal.request.status as RequestStatus]
              : SHIFT_STATUS_LABELS[proposal.status as ShiftStatus];

            return (
              <li
                key={proposal.id}
                className="rounded-2xl border border-border/75 bg-background/90 px-4 py-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge className={SHIFT_TYPE_STYLES[proposal.shift_type as ShiftType]}>
                        {SHIFT_TYPE_LABELS[proposal.shift_type as ShiftType]}
                      </Badge>
                      <Badge className={statusClassName}>{statusLabel}</Badge>
                      {proposal.exchangeId && (
                        <Badge variant="outline" className="text-foreground">
                          Intercambio creado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatShortDate(proposal.date)} - {timeRange}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getProposalSummary(proposal)}
                    </p>
                    {proposal.description && (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {proposal.description}
                      </p>
                    )}
                    {isPending && !isRecipient && (
                      <p className="text-xs font-medium text-muted-foreground">
                        Esperando respuesta de {otherUserName}.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {proposal.exchangeId && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/exchanges/${proposal.exchangeId}`}>
                          Ver intercambio
                        </Link>
                      </Button>
                    )}
                    {isRecipient && isPending && proposal.request && (
                      <>
                        <form action={acceptDirectProposal}>
                          <input
                            type="hidden"
                            name="request_id"
                            value={proposal.request.id}
                          />
                          <input type="hidden" name="shift_id" value={proposal.id} />
                          <input
                            type="hidden"
                            name="conversation_id"
                            value={conversationId}
                          />
                          <Button type="submit" size="sm">
                            <Check className="size-4" />
                            Aceptar
                          </Button>
                        </form>
                        <form action={rejectDirectProposal}>
                          <input
                            type="hidden"
                            name="request_id"
                            value={proposal.request.id}
                          />
                          <input type="hidden" name="shift_id" value={proposal.id} />
                          <input
                            type="hidden"
                            name="conversation_id"
                            value={conversationId}
                          />
                          <Button type="submit" size="sm" variant="outline">
                            <X className="size-4" />
                            Rechazar
                          </Button>
                        </form>
                      </>
                    )}
                    {isPending && !isRecipient && (
                      <Badge variant="outline" className="text-foreground">
                        <Clock className="mr-1 size-3" />
                        Pendiente
                      </Badge>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
