import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { getHoursBankTransactionStatusForExchange } from "@/lib/exchange-compensation";
import {
  canAccessExchange,
  EXCHANGE_EXPORTABLE_STATUSES,
  getAuthenticatedExchangeActor,
} from "@/lib/exchange-workflow";
import { ExchangeCorporatePdf, type ExchangePdfData } from "@/lib/exchange-pdf-document";
import { getExchangePdfDownloadName } from "@/lib/exchange-documents";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickFirstRelation } from "@/lib/supabase-relations";
import { createClient } from "@/lib/supabase/server";
import type { ExchangeAgreementType, ExchangeStatus, ShiftType } from "@/types";

export const runtime = "nodejs";

const ARCELOR_LOGO_ASSET_PATH = ["public", "brand", "arcelormittal-logo.png"];

interface ExchangeDocumentDetail {
  id: string;
  status: ExchangeStatus;
  agreement_type: ExchangeAgreementType | null;
  compensation_shift_date: string | null;
  compensation_shift_type: ShiftType | "rest" | null;
  created_at: string;
  confirmed_at: string | null;
  signed_by_user_a_at: string | null;
  signed_by_user_b_at: string | null;
  signed_by_user_a_name: string | null;
  signed_by_user_b_name: string | null;
  submitted_for_approval_at: string | null;
  department_reviewed_at: string | null;
  department_decision_notes: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  shift: {
    date: string;
    start_time: string;
    end_time: string;
    shift_type: ShiftType;
    department: {
      id: string;
      name: string;
      company_id: string;
      company: { name: string } | null;
    };
  };
  owner: {
    id: string;
    full_name: string;
    email: string;
    employee_id: string | null;
    signature_url: string | null;
  };
  requester: {
    id: string;
    full_name: string;
    email: string;
    employee_id: string | null;
    signature_url: string | null;
  };
  departmentApprover: {
    full_name: string;
    email: string;
  } | null;
  user_a_id: string;
  user_b_id: string;
}

async function loadArcelorLogoDataUri(): Promise<string> {
  const logoBuffer = await readFile(path.join(process.cwd(), ...ARCELOR_LOGO_ASSET_PATH));
  return `data:image/png;base64,${logoBuffer.toString("base64")}`;
}

export async function GET(
  _request: Request,
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

  const actor = await getAuthenticatedExchangeActor(authUser.id);
  if (!actor) {
    return new Response("Unauthorized", { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data: exchange } = await adminClient
    .from("exchanges")
    .select(
      `
      id, status, agreement_type, compensation_shift_date, compensation_shift_type,
      created_at, confirmed_at,
      signed_by_user_a_at, signed_by_user_b_at,
      signed_by_user_a_name, signed_by_user_b_name,
      submitted_for_approval_at, department_reviewed_at,
      department_decision_notes, approved_at, rejected_at,
      user_a_id, user_b_id,
      shift:shifts!shift_id(
        date,
        start_time,
        end_time,
        shift_type,
        department:departments!department_id(
          id,
          name,
          company_id,
          company:companies!company_id(name)
        )
      ),
      owner:user_profiles!user_a_id(id, full_name, email, employee_id, signature_url),
      requester:user_profiles!user_b_id(id, full_name, email, employee_id, signature_url),
      departmentApprover:user_profiles!department_approver_id(full_name, email)
    `
    )
    .eq("id", id)
    .maybeSingle();

  const rawExchange = (exchange as unknown as
    | (ExchangeDocumentDetail & {
        shift:
          | (ExchangeDocumentDetail["shift"] & {
              department:
                | (ExchangeDocumentDetail["shift"]["department"] & {
                    company:
                      | ExchangeDocumentDetail["shift"]["department"]["company"]
                      | ExchangeDocumentDetail["shift"]["department"]["company"][];
                  })
                | ExchangeDocumentDetail["shift"]["department"][];
            })
          | ExchangeDocumentDetail["shift"][];
        owner:
          | ExchangeDocumentDetail["owner"]
          | ExchangeDocumentDetail["owner"][];
        requester:
          | ExchangeDocumentDetail["requester"]
          | ExchangeDocumentDetail["requester"][];
        departmentApprover:
          | ExchangeDocumentDetail["departmentApprover"]
          | ExchangeDocumentDetail["departmentApprover"][];
      })
    | null) ?? null;

  const shift = rawExchange ? pickFirstRelation(rawExchange.shift) : null;
  const typedExchange =
    rawExchange && shift
      ? ({
          ...rawExchange,
          shift: {
            ...shift,
            department: {
              ...(pickFirstRelation(shift.department) ?? shift.department),
              company:
                pickFirstRelation(
                  (pickFirstRelation(shift.department) ?? shift.department).company
                ) ??
                (pickFirstRelation(shift.department) ?? shift.department).company,
            },
          },
          owner: pickFirstRelation(rawExchange.owner),
          requester: pickFirstRelation(rawExchange.requester),
          departmentApprover: pickFirstRelation(rawExchange.departmentApprover),
        } as ExchangeDocumentDetail)
      : null;

  if (!typedExchange || !typedExchange.owner || !typedExchange.requester) {
    return new Response("Not found", { status: 404 });
  }

  if (
    !canAccessExchange(actor, {
      user_a_id: typedExchange.user_a_id,
      user_b_id: typedExchange.user_b_id,
      company_id: typedExchange.shift.department.company_id,
      department_id: typedExchange.shift.department.id,
    })
  ) {
    return new Response("Not found", { status: 404 });
  }

  if (!EXCHANGE_EXPORTABLE_STATUSES.includes(typedExchange.status)) {
    return new Response("Exchange not ready for export", { status: 400 });
  }

  try {
    const logoDataUri = await loadArcelorLogoDataUri();
    const pdfBuffer = await renderToBuffer(
      <ExchangeCorporatePdf
        exchange={{
          id: typedExchange.id,
          status: typedExchange.status,
          agreement_type: typedExchange.agreement_type,
          created_at: typedExchange.created_at,
          confirmed_at: typedExchange.confirmed_at,
          submitted_for_approval_at: typedExchange.submitted_for_approval_at,
          department_reviewed_at: typedExchange.department_reviewed_at,
          department_decision_notes: typedExchange.department_decision_notes,
          approved_at: typedExchange.approved_at,
          rejected_at: typedExchange.rejected_at,
          signed_by_user_a_at: typedExchange.signed_by_user_a_at,
          signed_by_user_b_at: typedExchange.signed_by_user_b_at,
          signed_by_user_a_name: typedExchange.signed_by_user_a_name,
          signed_by_user_b_name: typedExchange.signed_by_user_b_name,
          shift: {
            date: typedExchange.shift.date,
            start_time: typedExchange.shift.start_time,
            end_time: typedExchange.shift.end_time,
            shift_type: typedExchange.shift.shift_type,
            department_name: typedExchange.shift.department.name,
            company_name:
              typedExchange.shift.department.company?.name ?? "ArcelorMittal",
            target_shift_type: typedExchange.compensation_shift_type,
            target_shift_date: typedExchange.compensation_shift_date,
          },
          owner: {
            full_name: typedExchange.owner.full_name,
            employee_id: typedExchange.owner.employee_id,
            category: null,
            position: null,
            signature_url: typedExchange.owner.signature_url,
          },
          requester: {
            full_name: typedExchange.requester.full_name,
            employee_id: typedExchange.requester.employee_id,
            category: null,
            position: null,
            signature_url: typedExchange.requester.signature_url,
          },
          departmentApprover: typedExchange.departmentApprover,
          hours_bank_status:
            typedExchange.agreement_type === "hours_bank"
              ? getHoursBankTransactionStatusForExchange(typedExchange.status)
              : null,
        } satisfies ExchangePdfData}
        logoDataUri={logoDataUri}
      />
    );

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${getExchangePdfDownloadName(
          id
        )}"`,
      },
    });
  } catch (error) {
    console.error(
      "[api/exchanges/[id]/pdf] Failed to generate corporate exchange PDF",
      error
    );
    return new Response("PDF generation failed", { status: 500 });
  }
}
