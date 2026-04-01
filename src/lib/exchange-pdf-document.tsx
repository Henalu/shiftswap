import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  EXCHANGE_AGREEMENT_LABELS,
  EXCHANGE_STATUS_LABELS,
  SHIFT_DEBT_TRANSACTION_STATUS_LABELS,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import { formatCompensationDateLabel } from "@/lib/exchange-compensation";
import {
  formatDate,
  formatShortDate,
  formatTime,
  formatTimeRange,
} from "@/lib/utils";
import type {
  ExchangeAgreementType,
  ExchangeStatus,
  ShiftDebtTransactionStatus,
  ShiftType,
} from "@/types";

const BRAND = {
  orange: "#f15a24",
  orangeSoft: "#fff1ec",
  ink: "#18212f",
  text: "#334155",
  muted: "#64748b",
  line: "#d6dee8",
  panel: "#f8fafc",
  white: "#ffffff",
  success: "#0f766e",
  successSoft: "#ecfdf5",
  warning: "#9a3412",
  warningSoft: "#fff7ed",
  info: "#1d4ed8",
  infoSoft: "#eff6ff",
  danger: "#b42318",
  dangerSoft: "#fef2f2",
} as const;

export interface ExchangePdfPerson {
  full_name: string;
  employee_id: string | null;
  category: string | null;
  position: string | null;
}

export interface ExchangePdfApprover {
  full_name: string;
  email: string;
}

export interface ExchangePdfData {
  id: string;
  status: ExchangeStatus;
  agreement_type: ExchangeAgreementType | null;
  created_at: string;
  confirmed_at: string | null;
  submitted_for_approval_at: string | null;
  department_reviewed_at: string | null;
  department_decision_notes: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  signed_by_user_a_at: string | null;
  signed_by_user_b_at: string | null;
  signed_by_user_a_name: string | null;
  signed_by_user_b_name: string | null;
  shift: {
    date: string;
    start_time: string;
    end_time: string;
    shift_type: ShiftType;
    department_name: string;
    company_name: string | null;
    target_shift_type: ShiftType | null;
    target_shift_date: string | null;
  };
  owner: ExchangePdfPerson;
  requester: ExchangePdfPerson;
  departmentApprover: ExchangePdfApprover | null;
  hours_bank_status: ShiftDebtTransactionStatus | null;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 42,
    paddingHorizontal: 38,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BRAND.text,
    backgroundColor: BRAND.white,
  },
  topAccent: {
    width: 84,
    height: 4,
    backgroundColor: BRAND.orange,
    borderRadius: 999,
    marginBottom: 14,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: BRAND.line,
    paddingBottom: 18,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logoWrap: {
    width: 180,
    height: 60,
    justifyContent: "center",
  },
  logo: {
    width: 168,
    height: 54,
    objectFit: "contain",
  },
  headerMeta: {
    width: 300,
    alignItems: "flex-end",
  },
  eyebrow: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: BRAND.orange,
    marginBottom: 6,
  },
  title: {
    fontSize: 21,
    fontWeight: 700,
    color: BRAND.ink,
    marginBottom: 6,
    textAlign: "right",
  },
  subtitle: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: BRAND.muted,
    textAlign: "right",
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: BRAND.ink,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHalf: {
    width: "48.6%",
  },
  card: {
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 14,
    backgroundColor: BRAND.panel,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 16,
    backgroundColor: BRAND.panel,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  narrativeCard: {
    borderWidth: 1,
    borderColor: "#f7c8b5",
    borderRadius: 16,
    backgroundColor: BRAND.orangeSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  label: {
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: BRAND.muted,
    marginBottom: 4,
  },
  value: {
    fontSize: 11,
    fontWeight: 700,
    color: BRAND.ink,
    lineHeight: 1.25,
  },
  secondaryValue: {
    fontSize: 9,
    color: BRAND.text,
    lineHeight: 1.4,
    marginTop: 3,
  },
  placeholderValue: {
    fontSize: 9,
    color: BRAND.muted,
    fontStyle: "italic",
    lineHeight: 1.4,
  },
  cardRowSpacing: {
    marginBottom: 10,
  },
  participantHeader: {
    marginBottom: 10,
  },
  participantTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: BRAND.ink,
    marginBottom: 2,
  },
  participantMeta: {
    fontSize: 8.5,
    color: BRAND.muted,
  },
  valueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderTopWidth: 1,
    borderTopColor: BRAND.line,
    paddingTop: 7,
    marginTop: 7,
  },
  valueRowLabel: {
    width: "36%",
    fontSize: 8,
    color: BRAND.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  valueRowValue: {
    width: "61%",
    fontSize: 9.5,
    color: BRAND.ink,
    textAlign: "right",
    lineHeight: 1.35,
  },
  descriptionText: {
    fontSize: 9.5,
    lineHeight: 1.55,
    color: BRAND.text,
  },
  signatureCard: {
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 16,
    backgroundColor: BRAND.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 112,
    justifyContent: "space-between",
  },
  signatureHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  signatureTitle: {
    fontSize: 11.5,
    fontWeight: 700,
    color: BRAND.ink,
    marginBottom: 2,
  },
  signatureRole: {
    fontSize: 8.5,
    color: BRAND.muted,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  signatureLineWrap: {
    paddingTop: 14,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: BRAND.ink,
    paddingTop: 5,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: 700,
    color: BRAND.ink,
  },
  signatureDate: {
    fontSize: 8.5,
    color: BRAND.muted,
    marginTop: 2,
  },
  diligenceCard: {
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  diligenceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  diligenceTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: BRAND.ink,
    marginBottom: 2,
  },
  diligenceMeta: {
    fontSize: 8.5,
    color: BRAND.muted,
  },
  notesBlock: {
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 12,
    backgroundColor: BRAND.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 76,
  },
  notesText: {
    fontSize: 9.5,
    lineHeight: 1.55,
    color: BRAND.text,
  },
  approvalSide: {
    width: "32%",
  },
  approvalMain: {
    width: "64.5%",
  },
  infoListItem: {
    marginBottom: 8,
  },
  smallValue: {
    fontSize: 9,
    color: BRAND.text,
    lineHeight: 1.45,
  },
  timelineGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  timelineItem: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BRAND.white,
    marginBottom: 8,
  },
  timelineTitle: {
    fontSize: 8,
    color: BRAND.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  timelineValue: {
    fontSize: 9.5,
    color: BRAND.ink,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    left: 38,
    right: 38,
    bottom: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BRAND.line,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    width: "62%",
    fontSize: 8,
    color: BRAND.muted,
    lineHeight: 1.4,
  },
  footerMeta: {
    width: "34%",
    fontSize: 8,
    color: BRAND.muted,
    textAlign: "right",
    lineHeight: 1.4,
  },
});

function getStatusPalette(status: ExchangeStatus) {
  if (status === "approved") {
    return {
      backgroundColor: BRAND.successSoft,
      borderColor: "#a7f3d0",
      color: BRAND.success,
    };
  }

  if (status === "rejected" || status === "cancelled") {
    return {
      backgroundColor: BRAND.dangerSoft,
      borderColor: "#fecaca",
      color: BRAND.danger,
    };
  }

  if (status === "pending_validation") {
    return {
      backgroundColor: BRAND.warningSoft,
      borderColor: "#fdba74",
      color: BRAND.warning,
    };
  }

  return {
    backgroundColor: BRAND.infoSoft,
    borderColor: "#bfdbfe",
    color: BRAND.info,
  };
}

function formatDateOrPlaceholder(value: string | null | undefined) {
  return value ? formatShortDate(value) : "Pendiente";
}

function getFormalRequestDate(exchange: ExchangePdfData) {
  return (
    exchange.submitted_for_approval_at ??
    exchange.confirmed_at ??
    exchange.created_at
  );
}

function getLastUpdatedLabel(exchange: ExchangePdfData) {
  return (
    exchange.department_reviewed_at ??
    exchange.approved_at ??
    exchange.rejected_at ??
    exchange.submitted_for_approval_at ??
    exchange.confirmed_at ??
    exchange.created_at
  );
}

function getApprovalLabel(exchange: ExchangePdfData) {
  if (exchange.status === "approved") {
    return "Aprobado por departamento";
  }

  if (exchange.status === "rejected") {
    return "Rechazado por departamento";
  }

  if (exchange.status === "pending_validation") {
    return "Pendiente de aprobacion";
  }

  if (exchange.status === "accepted") {
    return "Pendiente de firma";
  }

  return EXCHANGE_STATUS_LABELS[exchange.status];
}

function getDecisionText(exchange: ExchangePdfData) {
  if (exchange.department_decision_notes?.trim()) {
    return exchange.department_decision_notes.trim();
  }

  if (exchange.status === "approved") {
    return "Solicitud aprobada dentro del flujo interno de ShiftSwap y lista para ejecutarse como cambio autorizado.";
  }

  if (exchange.status === "rejected") {
    return "La solicitud fue rechazada por el taller o departamento. Revisa el expediente en ShiftSwap para continuar.";
  }

  if (exchange.status === "pending_validation") {
    return "La solicitud ya cuenta con acuerdo y firmas de las partes. Queda pendiente de resolucion por parte del taller o departamento.";
  }

  return "El expediente sigue en curso dentro de ShiftSwap y aun no tiene una resolucion departamental final.";
}

function getFieldValue(value: string | null | undefined) {
  return value?.trim() ? value.trim() : "No informado en ShiftSwap";
}

function getAgreementNarrative(
  exchange: ExchangePdfData,
  sourceShiftLabel: string,
  sourceShiftTime: string
) {
  const sourceShiftDate = formatShortDate(exchange.shift.date);

  if (exchange.agreement_type === "hours_bank") {
    return `${exchange.requester.full_name} realizara el turno de ${sourceShiftLabel} del ${sourceShiftDate} (${sourceShiftTime}) por ${exchange.owner.full_name}. La compensacion se registra como bolsa de horas y deja una deuda de 1 turno a favor de ${exchange.requester.full_name}.`;
  }

  if (exchange.agreement_type === "shift_exchange") {
    const targetShiftLabel = exchange.shift.target_shift_type
      ? SHIFT_TYPE_LABELS[exchange.shift.target_shift_type]
      : "turno pendiente";
    const targetShiftDate =
      formatCompensationDateLabel(exchange.shift.target_shift_date) ??
      "fecha pendiente";

    return `${exchange.requester.full_name} solicita cubrir el turno de ${sourceShiftLabel} del ${sourceShiftDate} (${sourceShiftTime}) por ${exchange.owner.full_name}, con compensacion futura prevista para el turno de ${targetShiftLabel} del ${targetShiftDate}.`;
  }

  return `${exchange.requester.full_name} solicita intercambiar con ${exchange.owner.full_name} el turno de ${sourceShiftLabel} del ${sourceShiftDate} (${sourceShiftTime}). El expediente conserva el estado operativo real de ShiftSwap y puede exportarse incluso antes de la resolucion final del departamento.`;
}

function getCompensationCardLines(exchange: ExchangePdfData) {
  if (exchange.agreement_type === "hours_bank") {
    return {
      label: "Compensacion acordada",
      value: EXCHANGE_AGREEMENT_LABELS.hours_bank,
      secondaryLines: [
        `${exchange.owner.full_name} queda debiendo 1 turno a ${exchange.requester.full_name}.`,
        exchange.hours_bank_status
          ? `Estado de la deuda: ${SHIFT_DEBT_TRANSACTION_STATUS_LABELS[exchange.hours_bank_status]}.`
          : "La deuda se registra dentro del expediente actual.",
      ],
      isPlaceholder: false,
    };
  }

  if (exchange.agreement_type === "shift_exchange") {
    const targetShiftLabel = exchange.shift.target_shift_type
      ? SHIFT_TYPE_LABELS[exchange.shift.target_shift_type]
      : "Pendiente de definir";
    const targetShiftDate =
      formatCompensationDateLabel(exchange.shift.target_shift_date) ??
      "Pendiente de definir";

    return {
      label: "Compensacion acordada",
      value: targetShiftLabel,
      secondaryLines: [
        `Fecha acordada: ${targetShiftDate}.`,
        `Tipo de acuerdo: ${EXCHANGE_AGREEMENT_LABELS.shift_exchange}.`,
      ],
      isPlaceholder: targetShiftLabel === "Pendiente de definir",
    };
  }

  return {
    label: "Compensacion acordada",
    value: "Pendiente de definir",
    secondaryLines: [
      "La persona interesada debe indicar si el acuerdo es bolsa de horas o intercambio de turno.",
      "El expediente seguira mostrando el estado real de ShiftSwap en cada exportacion.",
    ],
    isPlaceholder: true,
  };
}

function SummaryCard({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <View style={[styles.card, styles.cardHalf]} wrap={false}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {secondary ? <Text style={styles.secondaryValue}>{secondary}</Text> : null}
    </View>
  );
}

function PersonCard({
  title,
  subtitle,
  person,
}: {
  title: string;
  subtitle: string;
  person: ExchangePdfPerson;
}) {
  return (
    <View style={[styles.card, styles.cardHalf]} wrap={false}>
      <View style={styles.participantHeader}>
        <Text style={styles.participantTitle}>{title}</Text>
        <Text style={styles.participantMeta}>{subtitle}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.valueRowLabel}>Nombre</Text>
        <Text style={styles.valueRowValue}>{person.full_name}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.valueRowLabel}>Matricula</Text>
        <Text style={styles.valueRowValue}>{getFieldValue(person.employee_id)}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.valueRowLabel}>Categoria</Text>
        <Text style={styles.valueRowValue}>{getFieldValue(person.category)}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.valueRowLabel}>Puesto</Text>
        <Text style={styles.valueRowValue}>{getFieldValue(person.position)}</Text>
      </View>
    </View>
  );
}

function SignatureCard({
  title,
  role,
  signerName,
  signedAt,
}: {
  title: string;
  role: string;
  signerName: string;
  signedAt: string | null;
}) {
  const isSigned = Boolean(signedAt);
  const badgeStyle = isSigned
    ? {
        backgroundColor: BRAND.successSoft,
        borderColor: "#a7f3d0",
        color: BRAND.success,
      }
    : {
        backgroundColor: BRAND.warningSoft,
        borderColor: "#fdba74",
        color: BRAND.warning,
      };

  return (
    <View style={[styles.signatureCard, styles.cardHalf]} wrap={false}>
      <View style={styles.signatureHeader}>
        <View>
          <Text style={styles.signatureTitle}>{title}</Text>
          <Text style={styles.signatureRole}>{role}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: badgeStyle.backgroundColor,
              borderColor: badgeStyle.borderColor,
            },
          ]}
        >
          <Text style={[styles.statusBadgeText, { color: badgeStyle.color }]}>
            {isSigned ? "Firmado" : "Pendiente"}
          </Text>
        </View>
      </View>

      <Text style={styles.smallValue}>
        {isSigned
          ? `Firma registrada en ShiftSwap el ${formatShortDate(
              signedAt as string
            )} a las ${formatTime(signedAt as string)}.`
          : "La firma aun no consta dentro del expediente exportado."}
      </Text>

      <View style={styles.signatureLineWrap}>
        <View style={styles.signatureLine}>
          <Text style={styles.signatureName}>{signerName}</Text>
          <Text style={styles.signatureDate}>
            {isSigned ? formatDate(signedAt as string) : "Firma pendiente"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function TimelineItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.timelineItem} wrap={false}>
      <Text style={styles.timelineTitle}>{label}</Text>
      <Text style={styles.timelineValue}>{value}</Text>
    </View>
  );
}

export function ExchangeCorporatePdf({
  exchange,
  logoDataUri,
}: {
  exchange: ExchangePdfData;
  logoDataUri: string;
}) {
  const palette = getStatusPalette(exchange.status);
  const companyName = exchange.shift.company_name ?? "ArcelorMittal";
  const requestDate = getFormalRequestDate(exchange);
  const lastUpdated = getLastUpdatedLabel(exchange);
  const sourceShiftLabel = SHIFT_TYPE_LABELS[exchange.shift.shift_type];
  const sourceShiftDate = formatDate(exchange.shift.date);
  const sourceShiftTime = formatTimeRange(
    exchange.shift.start_time,
    exchange.shift.end_time
  );
  const ownerSignerName =
    exchange.signed_by_user_a_name ?? exchange.owner.full_name;
  const requesterSignerName =
    exchange.signed_by_user_b_name ?? exchange.requester.full_name;
  const compensationCard = getCompensationCardLines(exchange);
  const agreementNarrative = getAgreementNarrative(
    exchange,
    sourceShiftLabel,
    sourceShiftTime
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topAccent} />

        <View style={styles.header} wrap={false}>
          <View style={styles.headerRow}>
            <View style={styles.logoWrap}>
              <PdfImage
                src={logoDataUri}
                style={styles.logo}
              />
            </View>

            <View style={styles.headerMeta}>
              <Text style={styles.eyebrow}>ShiftSwap | Documento corporativo</Text>
              <Text style={styles.title}>Solicitud de cambio de turno</Text>
              <Text style={styles.subtitle}>
                Expediente {exchange.id.slice(0, 8)}. Documento generado para el
                flujo interno de {companyName}. Mantiene el estado operativo de
                ShiftSwap y la informacion relevante para revision.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos generales</Text>
          <View style={styles.row}>
            <SummaryCard
              label="Estado actual"
              value={getApprovalLabel(exchange)}
              secondary={`Ultima actualizacion: ${formatDate(lastUpdated)}`}
            />
            <SummaryCard
              label="Departamento o taller"
              value={exchange.shift.department_name}
              secondary={companyName}
            />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <SummaryCard
              label="Fecha de solicitud"
              value={formatDate(requestDate)}
              secondary={`Referencia ${exchange.id.slice(0, 8).toUpperCase()}`}
            />
            <SummaryCard
              label="Jornada origen"
              value={sourceShiftLabel}
              secondary={`${formatShortDate(exchange.shift.date)} | ${sourceShiftTime}`}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Empleados implicados</Text>
          <View style={styles.row}>
            <PersonCard
              title={exchange.owner.full_name}
              subtitle="Propietario del turno"
              person={exchange.owner}
            />
            <PersonCard
              title={exchange.requester.full_name}
              subtitle="Solicitante del cambio"
              person={exchange.requester}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen del intercambio solicitado</Text>

          <View style={styles.narrativeCard}>
            <Text style={styles.descriptionText}>{agreementNarrative}</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.summaryCard, styles.cardHalf]} wrap={false}>
              <Text style={styles.label}>Turno origen</Text>
              <Text style={styles.value}>{sourceShiftLabel}</Text>
              <Text style={styles.secondaryValue}>{sourceShiftDate}</Text>
              <Text style={styles.secondaryValue}>{sourceShiftTime}</Text>
            </View>

            <View style={[styles.summaryCard, styles.cardHalf]} wrap={false}>
              <Text style={styles.label}>{compensationCard.label}</Text>
              <Text
                style={
                  compensationCard.isPlaceholder
                    ? styles.placeholderValue
                    : styles.value
                }
              >
                {compensationCard.value}
              </Text>
              {compensationCard.secondaryLines.map((line) => (
                <Text
                  key={line}
                  style={
                    compensationCard.isPlaceholder
                      ? styles.placeholderValue
                      : styles.secondaryValue
                  }
                >
                  {line}
                </Text>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Firmas de empleados</Text>
          <View style={styles.row}>
            <SignatureCard
              title={exchange.owner.full_name}
              role="Firma del propietario"
              signerName={ownerSignerName}
              signedAt={exchange.signed_by_user_a_at}
            />
            <SignatureCard
              title={exchange.requester.full_name}
              role="Firma del solicitante"
              signerName={requesterSignerName}
              signedAt={exchange.signed_by_user_b_at}
            />
          </View>
        </View>

        <View
          style={[
            styles.section,
            styles.diligenceCard,
            {
              backgroundColor: palette.backgroundColor,
              borderColor: palette.borderColor,
            },
          ]}
        >
          <View style={styles.diligenceHeader}>
            <View>
              <Text style={styles.diligenceTitle}>
                Diligencia del taller o departamento
              </Text>
              <Text style={styles.diligenceMeta}>
                Estado ShiftSwap: {EXCHANGE_STATUS_LABELS[exchange.status]}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: BRAND.white,
                  borderColor: palette.borderColor,
                },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: palette.color }]}>
                {getApprovalLabel(exchange)}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.approvalMain}>
              <Text style={styles.label}>Razones alegadas / comentarios</Text>
              <View style={styles.notesBlock}>
                <Text style={styles.notesText}>{getDecisionText(exchange)}</Text>
              </View>
            </View>

            <View style={styles.approvalSide}>
              <View style={styles.infoListItem}>
                <Text style={styles.label}>Firma final</Text>
                <Text style={styles.value}>
                  {exchange.departmentApprover?.full_name ?? "Pendiente"}
                </Text>
                <Text style={styles.secondaryValue}>
                  {exchange.departmentApprover
                    ? exchange.departmentApprover.email
                    : "Sin responsable asignado todavia"}
                </Text>
              </View>

              <View style={styles.infoListItem}>
                <Text style={styles.label}>Fecha de revision</Text>
                <Text style={styles.smallValue}>
                  {formatDateOrPlaceholder(exchange.department_reviewed_at)}
                </Text>
              </View>

              <View>
                <Text style={styles.label}>Resultado</Text>
                <Text style={styles.smallValue}>{getApprovalLabel(exchange)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado y trazabilidad</Text>
          <View style={styles.timelineGrid}>
            <TimelineItem
              label="Acuerdo confirmado"
              value={formatDateOrPlaceholder(exchange.confirmed_at)}
            />
            <TimelineItem
              label="Firma propietario"
              value={formatDateOrPlaceholder(exchange.signed_by_user_a_at)}
            />
            <TimelineItem
              label="Firma solicitante"
              value={formatDateOrPlaceholder(exchange.signed_by_user_b_at)}
            />
            <TimelineItem
              label="Enviado a aprobacion"
              value={formatDateOrPlaceholder(exchange.submitted_for_approval_at)}
            />
            <TimelineItem
              label="Revision del departamento"
              value={formatDateOrPlaceholder(exchange.department_reviewed_at)}
            />
            <TimelineItem
              label="Ultimo estado"
              value={EXCHANGE_STATUS_LABELS[exchange.status]}
            />
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Documento generado automaticamente por ShiftSwap para soporte del
            proceso interno de ArcelorMittal. Refleja el estado operativo del
            expediente en la fecha de exportacion.
          </Text>
          <Text style={styles.footerMeta}>
            Generado el {formatDate(new Date())}
            {"\n"}
            Expediente {exchange.id}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
