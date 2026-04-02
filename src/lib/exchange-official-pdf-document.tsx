import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ExchangeAgreementType, ExchangeStatus, ShiftType } from "@/types";

export interface ExchangeOfficialPdfPerson {
  full_name: string;
  employee_id: string | null;
  category: string | null;
  position: string | null;
  signature_url: string | null;
}

export interface ExchangeOfficialPdfApprover {
  full_name: string;
}

export interface ExchangeOfficialPdfData {
  id: string;
  status: ExchangeStatus;
  agreement_type: ExchangeAgreementType | null;
  created_at: string;
  confirmed_at: string | null;
  submitted_for_approval_at: string | null;
  department_reviewed_at: string | null;
  department_decision_notes: string | null;
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
    target_shift_type: ShiftType | null;
    target_shift_date: string | null;
  };
  owner: ExchangeOfficialPdfPerson;
  requester: ExchangeOfficialPdfPerson;
  departmentApprover: ExchangeOfficialPdfApprover | null;
}

const OFFICIAL_SHIFT_LABELS: Record<ShiftType, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
  night: "Noche",
  normal_full: "Jornada completa",
  normal_short: "Jornada reducida",
};

const SIGNATURE_NAME_CONNECTORS = new Set([
  "da",
  "das",
  "de",
  "del",
  "do",
  "dos",
  "la",
  "las",
  "los",
  "van",
  "von",
  "y",
]);

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingRight: 22,
    paddingBottom: 16,
    paddingLeft: 51,
    fontFamily: "Helvetica",
    fontSize: 9.6,
    color: "#000000",
    lineHeight: 1.35,
    backgroundColor: "#ffffff",
  },
  frame: {
    borderWidth: 1,
    borderColor: "#000000",
  },
  headerRow: {
    flexDirection: "row",
    minHeight: 122,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  adminCell: {
    width: "33%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  logo: {
    width: 118,
    height: 50,
    objectFit: "contain",
  },
  adminTitle: {
    textAlign: "center",
    fontSize: 9,
    fontWeight: 700,
  },
  formTitleCell: {
    width: "42.3%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  formTitle: {
    fontSize: 14.8,
    fontWeight: 700,
    textAlign: "center",
  },
  codeCell: {
    width: "4.3%",
    borderRightWidth: 1,
    borderRightColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  codeText: {
    fontSize: 9,
    fontWeight: 700,
  },
  metaCell: {
    width: "20.4%",
  },
  metaHeader: {
    minHeight: 30,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingHorizontal: 8,
  },
  metaHeaderText: {
    fontSize: 9,
    fontWeight: 700,
    textAlign: "center",
  },
  metaValue: {
    minHeight: 30,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingHorizontal: 8,
  },
  metaValueText: {
    fontSize: 9.5,
    textAlign: "center",
  },
  dateHeader: {
    minHeight: 28,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingHorizontal: 8,
  },
  dateHeaderText: {
    fontSize: 9,
    fontWeight: 700,
  },
  dateRow: {
    flexDirection: "row",
    minHeight: 34,
  },
  dateCell: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000000",
  },
  dateCellLast: {
    borderRightWidth: 0,
  },
  dateCellText: {
    fontSize: 9.5,
  },
  bodySection: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    minHeight: 410,
  },
  numberedRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  numberedIndex: {
    width: 18,
    fontSize: 10,
  },
  numberedContent: {
    flex: 1,
    marginLeft: 8,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  fieldRowIndented: {
    paddingLeft: 26,
  },
  fieldLabel: {
    fontSize: 9.6,
  },
  fieldBox: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 14,
    justifyContent: "flex-end",
    paddingHorizontal: 4,
    paddingBottom: 1,
  },
  solicitanFieldBox: {
    paddingLeft: 7,
  },
  fieldBoxText: {
    fontSize: 9.4,
  },
  sectionHeading: {
    marginTop: 6,
    marginBottom: 10,
    fontSize: 10,
    fontWeight: 700,
    textDecoration: "underline",
  },
  paragraphIndented: {
    paddingLeft: 26,
    marginBottom: 8,
    fontSize: 9.6,
  },
  signatureHeading: {
    textAlign: "center",
    marginTop: 12,
    marginBottom: 18,
    fontSize: 10,
    fontWeight: 700,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  signatureColumn: {
    width: "47%",
    minHeight: 72,
    justifyContent: "flex-end",
  },
  signatureLine: {
    minHeight: 24,
    justifyContent: "flex-end",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 3,
  },
  signatureText: {
    fontSize: 13.6,
    fontWeight: 700,
    fontStyle: "italic",
    lineHeight: 1.05,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  signatureCaption: {
    marginTop: 4,
    fontSize: 8.4,
    textAlign: "center",
  },
  signatureImage: {
    width: 140,
    height: 52,
    objectFit: "contain" as const,
    marginBottom: 4,
  },
  diligenceSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 210,
  },
  diligenceTitle: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: 700,
    textDecoration: "underline",
    marginBottom: 12,
  },
  approvalTable: {
    width: 235,
    marginLeft: 215,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#000000",
  },
  approvalRow: {
    flexDirection: "row",
    minHeight: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  approvalLabelCell: {
    width: 145,
    borderRightWidth: 1,
    borderRightColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  approvalYesCell: {
    width: 52,
    borderRightWidth: 1,
    borderRightColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  approvalSignatureCell: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  approvalText: {
    fontSize: 9.2,
    textAlign: "center",
  },
  approvalSignatureText: {
    fontSize: 5.8,
    fontWeight: 700,
    fontStyle: "italic",
    lineHeight: 1,
    letterSpacing: 0.15,
    textAlign: "center",
  },
  approvalMark: {
    fontSize: 13,
    fontWeight: 700,
  },
  approvalSignatureLine: {
    width: 34,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    height: 10,
  },
  reasonLabel: {
    fontSize: 9.5,
    marginBottom: 8,
  },
  reasonBox: {
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    marginBottom: 12,
    paddingBottom: 4,
  },
  reasonText: {
    fontSize: 9.3,
    lineHeight: 1.45,
  },
  approverRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 4,
  },
  approverLabel: {
    fontSize: 9.4,
    marginRight: 6,
  },
  approverBox: {
    flex: 0,
    width: 170,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    minHeight: 20,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 2,
    paddingHorizontal: 6,
  },
  approverSignatureText: {
    fontSize: 11.8,
    fontWeight: 700,
    fontStyle: "italic",
    lineHeight: 1.05,
    letterSpacing: 0.15,
    textAlign: "center",
  },
});

function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getDateParts(value: string | null | undefined) {
  const formatted = formatShortDate(value);

  if (!formatted) {
    return ["", "", ""];
  }

  return formatted.split("/");
}

function getOfficialShiftLabel(shiftType: ShiftType | null | undefined): string {
  if (!shiftType) {
    return "";
  }

  return OFFICIAL_SHIFT_LABELS[shiftType];
}

function getRequestDate(exchange: ExchangeOfficialPdfData): string {
  return (
    exchange.submitted_for_approval_at ??
    exchange.confirmed_at ??
    exchange.created_at
  );
}

function getDecisionText(exchange: ExchangeOfficialPdfData): string {
  const notes = exchange.department_decision_notes?.trim();

  if (notes) {
    return notes;
  }

  if (exchange.status === "approved") {
    return "Autorizado por el taller o departamento dentro del flujo de ShiftSwap.";
  }

  if (exchange.status === "rejected") {
    return "Solicitud rechazada por el taller o departamento.";
  }

  if (exchange.status === "pending_validation") {
    return "Pendiente de resolución por parte del taller o departamento.";
  }

  return "Solicitud registrada dentro de ShiftSwap y pendiente de completar su tramitación.";
}

function getValue(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function buildRequestedShiftSummary(exchange: ExchangeOfficialPdfData): {
  shiftLabel: string;
  dateLabel: string;
} {
  if (exchange.agreement_type === "shift_exchange") {
    return {
      shiftLabel: getOfficialShiftLabel(exchange.shift.target_shift_type),
      dateLabel: formatShortDate(exchange.shift.target_shift_date),
    };
  }

  return {
    shiftLabel: "",
    dateLabel: "",
  };
}

function getSignatureShortName(value: string): string {
  const parts = getValue(value)
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  if (parts[0].length <= 2) {
    return `${parts[0]} ${parts[1]}`;
  }

  return parts[0];
}

function getSignatureFirstNameAndSurname(value: string): string {
  const parts = getValue(value)
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const surname =
    parts
      .slice(1)
      .find((part) => !SIGNATURE_NAME_CONNECTORS.has(part.toLowerCase())) ??
    parts[1];

  return `${parts[0]} ${surname}`;
}

function shouldShowSignatureCaption(
  signatureShortName: string,
  formalName: string,
): boolean {
  if (!formalName) {
    return false;
  }

  if (!signatureShortName) {
    return true;
  }

  return signatureShortName.toLowerCase() !== formalName.toLowerCase();
}

function InlineField({
  label,
  value,
  width,
  marginRight = 10,
  extraLeftPadding = false,
}: {
  label: string;
  value: string;
  width: number | string;
  marginRight?: number;
  extraLeftPadding?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, { marginBottom: 0, marginRight }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.fieldBox,
          ...(extraLeftPadding ? [styles.solicitanFieldBox] : []),
          { width },
        ]}
      >
        <Text style={styles.fieldBoxText}>{value}</Text>
      </View>
    </View>
  );
}

function SignatureBlock({
  signatureName,
  formalName,
  signatureImageUrl,
}: {
  signatureName: string;
  formalName: string;
  signatureImageUrl?: string | null;
}) {
  const signatureShortName = getSignatureShortName(signatureName);
  const showSignatureCaption = shouldShowSignatureCaption(
    signatureShortName,
    formalName,
  );

  return (
    <View style={styles.signatureColumn}>
      {signatureName && signatureImageUrl ? (
        <PdfImage src={signatureImageUrl} style={styles.signatureImage} />
      ) : null}
      <View style={styles.signatureLine}>
        <Text style={styles.signatureText}>{signatureShortName}</Text>
      </View>
      <Text style={styles.signatureCaption}>
        {showSignatureCaption ? formalName : ""}
      </Text>
    </View>
  );
}

export function ExchangeOfficialShiftChangePdf({
  exchange,
  logoDataUri,
}: {
  exchange: ExchangeOfficialPdfData;
  logoDataUri: string;
}) {
  const requestDate = getRequestDate(exchange);
  const [day, month, year] = getDateParts(requestDate);
  const requestedShift = buildRequestedShiftSummary(exchange);
  const approvalMark = exchange.status === "approved" ? "X" : "";
  const ownerFormalName = getValue(exchange.owner.full_name);
  const requesterFormalName = getValue(exchange.requester.full_name);
  const ownerSignature = exchange.signed_by_user_a_at
    ? getValue(exchange.signed_by_user_a_name) || ownerFormalName
    : "";
  const requesterSignature = exchange.signed_by_user_b_at
    ? getValue(exchange.signed_by_user_b_name) || requesterFormalName
    : "";
  const approverSignature = exchange.department_reviewed_at
    ? getValue(exchange.departmentApprover?.full_name)
    : "";
  const approverDisplaySignature =
    getSignatureFirstNameAndSurname(approverSignature);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.headerRow}>
            <View style={styles.adminCell}>
              <View style={styles.logoWrap}>
                <PdfImage src={logoDataUri} style={styles.logo} />
              </View>
              <Text style={styles.adminTitle}>ADMON. DE PERSONAL</Text>
            </View>

            <View style={styles.formTitleCell}>
              <Text style={styles.formTitle}>SOLICITUD CAMBIO DE TURNO</Text>
            </View>

            <View style={styles.codeCell}>
              <Text style={styles.codeText}>L-127</Text>
            </View>

            <View style={styles.metaCell}>
              <View style={styles.metaHeader}>
                <Text style={styles.metaHeaderText}>DPTO. O TALLER</Text>
              </View>
              <View style={styles.metaValue}>
                <Text style={styles.metaValueText}>
                  {exchange.shift.department_name}
                </Text>
              </View>
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>FECHA</Text>
              </View>
              <View style={styles.dateRow}>
                <View style={styles.dateCell}>
                  <Text style={styles.dateCellText}>{day}</Text>
                </View>
                <View style={styles.dateCell}>
                  <Text style={styles.dateCellText}>{month}</Text>
                </View>
                <View style={[styles.dateCell, styles.dateCellLast]}>
                  <Text style={styles.dateCellText}>{year}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.bodySection}>
            <View style={styles.numberedRow}>
              <Text style={styles.numberedIndex}>1.</Text>
              <View style={styles.numberedContent}>
                <View style={styles.fieldRow}>
                  <InlineField
                    label="D./Dª "
                    value={exchange.owner.full_name}
                    width={215}
                  />
                  <InlineField
                    label="Matrícula: "
                    value={getValue(exchange.owner.employee_id)}
                    width={78}
                    marginRight={0}
                  />
                </View>

                <View style={[styles.fieldRow, styles.fieldRowIndented]}>
                  <InlineField
                    label="Categoría "
                    value={getValue(exchange.owner.category)}
                    width={150}
                  />
                  <InlineField
                    label="Puesto de trabajo "
                    value={getValue(exchange.owner.position)}
                    width={170}
                    marginRight={0}
                  />
                </View>

                <View style={[styles.fieldRow, styles.fieldRowIndented]}>
                  <InlineField
                    label="y D./Dª "
                    value={exchange.requester.full_name}
                    width={220}
                  />
                  <InlineField
                    label="Matrícula: "
                    value={getValue(exchange.requester.employee_id)}
                    width={74}
                    marginRight={0}
                  />
                </View>

                <View style={[styles.fieldRow, styles.fieldRowIndented]}>
                  <InlineField
                    label="Categoría "
                    value={getValue(exchange.requester.category)}
                    width={146}
                  />
                  <InlineField
                    label="Puesto de trabajo "
                    value={getValue(exchange.requester.position)}
                    width={170}
                    marginRight={0}
                  />
                </View>
              </View>
            </View>

            <Text style={styles.sectionHeading}>EXPONEN:</Text>
            <Text style={styles.paragraphIndented}>
              Que de común acuerdo y en aplicación de lo dispuesto en el artículo
              12 del vigente Convenio Colectivo Sindical:
            </Text>

            <Text style={styles.sectionHeading}>SOLICITAN:</Text>

            <View style={[styles.fieldRow, styles.fieldRowIndented]}>
              <InlineField
                label="El cambio del "
                value={getOfficialShiftLabel(exchange.shift.shift_type)}
                width={105}
                extraLeftPadding
              />
              <Text style={styles.fieldLabel}> turno del día </Text>
              <View
                style={[
                  styles.fieldBox,
                  styles.solicitanFieldBox,
                  { width: 118, marginRight: 10 },
                ]}
              >
                <Text style={styles.fieldBoxText}>
                  {formatShortDate(exchange.shift.date)}
                </Text>
              </View>
              <Text style={styles.fieldLabel}> por el turno </Text>
              <View
                style={[
                  styles.fieldBox,
                  styles.solicitanFieldBox,
                  { width: 105 },
                ]}
              >
                <Text style={styles.fieldBoxText}>{requestedShift.shiftLabel}</Text>
              </View>
            </View>

            <View style={[styles.fieldRow, styles.fieldRowIndented]}>
              <Text style={styles.fieldLabel}>día </Text>
              <View
                style={[
                  styles.fieldBox,
                  styles.solicitanFieldBox,
                  { width: 128 },
                ]}
              >
                <Text style={styles.fieldBoxText}>{requestedShift.dateLabel}</Text>
              </View>
            </View>

            <Text style={styles.signatureHeading}>FIRMAS.</Text>

            <View style={styles.signatureRow}>
              <SignatureBlock
                signatureName={ownerSignature}
                formalName={ownerFormalName}
                signatureImageUrl={exchange.owner.signature_url}
              />
              <SignatureBlock
                signatureName={requesterSignature}
                formalName={requesterFormalName}
                signatureImageUrl={exchange.requester.signature_url}
              />
            </View>
          </View>

          <View style={styles.diligenceSection}>
            <Text style={styles.diligenceTitle}>
              DILIGENCIA DEL TALLER O DEPARTAMENTO
            </Text>

            <View style={styles.approvalTable}>
              <View style={styles.approvalRow}>
                <View style={styles.approvalLabelCell}>
                  <Text style={styles.approvalText}>Autoriza el cambio</Text>
                </View>
                <View style={styles.approvalYesCell}>
                  <Text style={styles.approvalText}>Sí</Text>
                </View>
                <View style={styles.approvalSignatureCell}>
                  <View style={styles.approvalSignatureLine} />
                </View>
              </View>

              <View style={[styles.approvalRow, { borderBottomWidth: 0 }]}>
                <View style={styles.approvalLabelCell}>
                  <Text style={styles.approvalText}>{""}</Text>
                </View>
                <View style={styles.approvalYesCell}>
                  <Text style={styles.approvalMark}>{approvalMark}</Text>
                </View>
                <View style={styles.approvalSignatureCell}>
                  <Text style={styles.approvalSignatureText}>
                    {approverDisplaySignature}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.reasonLabel}>Razones alegadas:</Text>
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>{getDecisionText(exchange)}</Text>
            </View>

            <View style={styles.approverRow}>
              <Text style={styles.approverLabel}>Fdo.:</Text>
              <View style={styles.approverBox}>
                <Text style={styles.approverSignatureText}>
                  {approverDisplaySignature}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
