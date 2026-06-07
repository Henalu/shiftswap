"use server";

import { revalidatePath } from "next/cache";
import { getSuggestionsToEmail } from "@/lib/app-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendTransactionalEmail } from "@/lib/transactional-email";

const MIN_SUGGESTION_LENGTH = 10;
const MAX_SUGGESTION_LENGTH = 2000;

type SuggestionEmailStatus = "sent" | "skipped" | "failed";

export interface SubmitSuggestionResult {
  success?: true;
  error?: string;
  emailStatus?: SuggestionEmailStatus;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string | null;
  department_id: string | null;
  employee_id: string | null;
  role: string | null;
}

interface NamedRow {
  name: string | null;
}

function getMadridDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function escapeHtml(value: string) {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return value.replace(/[&<>"']/g, (character) => replacements[character]);
}

function formatOptional(value: string | null | undefined) {
  return value?.trim() || "No disponible";
}

async function updateSuggestionEmailStatus(
  suggestionId: string,
  status: SuggestionEmailStatus,
  error?: string
) {
  const adminClient = createAdminClient();

  const { error: updateError } = await adminClient
    .from("suggestions")
    .update({
      email_status: status,
      email_error: error ? error.slice(0, 500) : null,
    })
    .eq("id", suggestionId);

  if (updateError) {
    console.error(
      "[help/actions] Failed to update suggestion email status",
      updateError.message
    );
  }
}

function buildSuggestionEmail(input: {
  content: string;
  profile: ProfileRow;
  authEmail: string | undefined;
  companyName: string | null;
  departmentName: string | null;
}) {
  const submitterName = formatOptional(input.profile.full_name);
  const submitterEmail = formatOptional(input.profile.email || input.authEmail);
  const companyName = formatOptional(input.companyName);
  const departmentName = formatOptional(input.departmentName);
  const employeeId = formatOptional(input.profile.employee_id);
  const escapedContent = escapeHtml(input.content).replace(/\n/g, "<br />");

  return {
    subject: "Nueva sugerencia en ShiftSwap",
    html: `
      <p>Hay una nueva sugerencia en ShiftSwap.</p>
      <p><strong>Usuario:</strong> ${escapeHtml(submitterName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(submitterEmail)}</p>
      <p><strong>Empresa:</strong> ${escapeHtml(companyName)}</p>
      <p><strong>Departamento:</strong> ${escapeHtml(departmentName)}</p>
      <p><strong>ID empleado:</strong> ${escapeHtml(employeeId)}</p>
      <p><strong>Sugerencia:</strong></p>
      <p>${escapedContent}</p>
    `,
    text: [
      "Nueva sugerencia en ShiftSwap",
      "",
      `Usuario: ${submitterName}`,
      `Email: ${submitterEmail}`,
      `Empresa: ${companyName}`,
      `Departamento: ${departmentName}`,
      `ID empleado: ${employeeId}`,
      "",
      "Sugerencia:",
      input.content,
    ].join("\n"),
  };
}

export async function submitSuggestion(
  formData: FormData
): Promise<SubmitSuggestionResult> {
  const content =
    (formData.get("content") as string | null)?.trim().replace(/\r\n/g, "\n") ||
    "";

  if (content.length < MIN_SUGGESTION_LENGTH) {
    return {
      error: `Escribe al menos ${MIN_SUGGESTION_LENGTH} caracteres.`,
    };
  }

  if (content.length > MAX_SUGGESTION_LENGTH) {
    return {
      error: `La sugerencia no puede superar ${MAX_SUGGESTION_LENGTH} caracteres.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autenticado." };
  }

  const submittedOn = getMadridDateKey();
  const adminClient = createAdminClient();

  const { data: existingSuggestion, error: existingSuggestionError } =
    await adminClient
      .from("suggestions")
      .select("id")
      .eq("user_id", user.id)
      .eq("submitted_on", submittedOn)
      .maybeSingle();

  if (existingSuggestionError) {
    return {
      error:
        "No se pudo comprobar tu limite diario. Intentalo de nuevo en unos minutos.",
    };
  }

  if (existingSuggestion) {
    return {
      error:
        "Ya has enviado una sugerencia hoy. Manana puedes enviar otra.",
    };
  }

  const { data: profileData, error: profileError } = await adminClient
    .from("user_profiles")
    .select("id, full_name, email, company_id, department_id, employee_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData) {
    return {
      error: "No se pudo cargar tu perfil para enviar la sugerencia.",
    };
  }

  const profile = profileData as ProfileRow;

  const { data: suggestionData, error: insertError } = await adminClient
    .from("suggestions")
    .insert({
      user_id: user.id,
      company_id: profile.company_id,
      content,
      submitted_on: submittedOn,
      email_status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        error:
          "Ya has enviado una sugerencia hoy. Manana puedes enviar otra.",
      };
    }

    return {
      error: "No se pudo guardar la sugerencia. " + insertError.message,
    };
  }

  const suggestionId = suggestionData.id as string;
  const suggestionsToEmail = getSuggestionsToEmail();

  if (!suggestionsToEmail) {
    await updateSuggestionEmailStatus(
      suggestionId,
      "skipped",
      "SUGGESTIONS_TO_EMAIL not configured"
    );
    revalidatePath("/help");
    return { success: true, emailStatus: "skipped" };
  }

  const [
    { data: companyData },
    { data: departmentData },
  ] = await Promise.all([
    profile.company_id
      ? adminClient
          .from("companies")
          .select("name")
          .eq("id", profile.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    profile.department_id
      ? adminClient
          .from("departments")
          .select("name")
          .eq("id", profile.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const email = buildSuggestionEmail({
    content,
    profile,
    authEmail: user.email,
    companyName: (companyData as NamedRow | null)?.name ?? null,
    departmentName: (departmentData as NamedRow | null)?.name ?? null,
  });

  try {
    const emailResult = await sendTransactionalEmail({
      to: suggestionsToEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (emailResult.skipped) {
      await updateSuggestionEmailStatus(
        suggestionId,
        "skipped",
        "Resend not configured"
      );
      revalidatePath("/help");
      return { success: true, emailStatus: "skipped" };
    }

    await updateSuggestionEmailStatus(suggestionId, "sent");
    revalidatePath("/help");
    return { success: true, emailStatus: "sent" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown email delivery error";

    console.error("[help/actions] Failed to send suggestion email", message);
    await updateSuggestionEmailStatus(suggestionId, "failed", message);
    revalidatePath("/help");
    return { success: true, emailStatus: "failed" };
  }
}
