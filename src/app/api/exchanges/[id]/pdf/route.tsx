import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 32,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 16,
  },
  appName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#2563eb",
    marginBottom: 4,
  },
  docTitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#6b7280",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    marginBottom: 6,
  },
  label: {
    width: 160,
    color: "#6b7280",
  },
  value: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },
  signatureSection: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: {
    width: "45%",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    marginTop: 48,
    marginBottom: 6,
  },
  signatureName: {
    fontSize: 10,
    color: "#6b7280",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    fontSize: 9,
    color: "#9ca3af",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
});

interface ExchangeData {
  id: string;
  status: string;
  confirmed_at: string | null;
  created_at: string;
  shift: {
    date: string;
    start_time: string;
    end_time: string;
    shift_type: string;
    department: { name: string };
  };
  owner: { full_name: string; email: string };
  requester: { full_name: string; email: string };
}

const SHIFT_TYPE_LABELS: Record<string, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
  night: "Noche",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  if (time?.includes(":")) {
    const [h, m] = time.split(":");
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  }
  return time;
}

function ExchangePdf({ exchange }: { exchange: ExchangeData }) {
  const timeRange = `${formatTime(exchange.shift.start_time)} – ${formatTime(exchange.shift.end_time)}`;
  const confirmedAt = exchange.confirmed_at
    ? formatDate(exchange.confirmed_at)
    : "—";

  return (
    <Document
      title={`Confirmacion de intercambio de turno - ShiftSwap`}
      author="ShiftSwap"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>ShiftSwap</Text>
          <Text style={styles.docTitle}>
            Documento de confirmación de intercambio de turno
          </Text>
        </View>

        {/* Shift details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Turno intercambiado</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha:</Text>
            <Text style={styles.value}>{formatDate(exchange.shift.date)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Horario:</Text>
            <Text style={styles.value}>{timeRange}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tipo:</Text>
            <Text style={styles.value}>
              {SHIFT_TYPE_LABELS[exchange.shift.shift_type] ?? exchange.shift.shift_type}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Departamento:</Text>
            <Text style={styles.value}>{exchange.shift.department.name}</Text>
          </View>
        </View>

        {/* Participants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Empleados</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Propietario del turno:</Text>
            <Text style={styles.value}>
              {exchange.owner.full_name} ({exchange.owner.email})
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Solicitante:</Text>
            <Text style={styles.value}>
              {exchange.requester.full_name} ({exchange.requester.email})
            </Text>
          </View>
        </View>

        {/* Confirmation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Confirmación</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Estado:</Text>
            <Text style={styles.value}>
              {exchange.status === "signed" ? "Firmado" : "Confirmado"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha de confirmación:</Text>
            <Text style={styles.value}>{confirmedAt}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Nº referencia:</Text>
            <Text style={styles.value}>{exchange.id}</Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>
              {exchange.owner.full_name}
            </Text>
            <Text style={styles.signatureName}>Propietario del turno</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>
              {exchange.requester.full_name}
            </Text>
            <Text style={styles.signatureName}>Solicitante</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Documento generado automáticamente por ShiftSwap el{" "}
          {new Date().toLocaleDateString("es-ES")} · Ref: {exchange.id}
        </Text>
      </Page>
    </Document>
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: exchange } = await supabase
    .from("exchanges")
    .select(
      `
      id, confirmed_at, created_at, status,
      shift:shifts!shift_id(date, start_time, end_time, shift_type,
        department:departments!department_id(name)),
      owner:user_profiles!user_a_id(full_name, email),
      requester:user_profiles!user_b_id(full_name, email)
    `
    )
    .eq("id", id)
    .or(`user_a_id.eq.${authUser.id},user_b_id.eq.${authUser.id}`)
    .single();

  if (!exchange) {
    return new Response("Not found", { status: 404 });
  }

  const typed = exchange as unknown as ExchangeData;

  if (
    typed.status !== "confirmed" &&
    typed.status !== "signed" &&
    typed.status !== "completed"
  ) {
    return new Response("Exchange not confirmed yet", { status: 400 });
  }

  const buffer = await renderToBuffer(<ExchangePdf exchange={typed} />);
  const pdfBytes = new Uint8Array(buffer);

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="intercambio-${id.slice(0, 8)}.pdf"`,
    },
  });
}
