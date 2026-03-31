import "server-only";

import {
  getResendApiKey,
  getResendFromEmail,
  getAppUrl,
} from "@/lib/app-config";

interface TransactionalEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function canSendTransactionalEmail() {
  return Boolean(getResendApiKey() && getResendFromEmail());
}

export async function sendTransactionalEmail(input: TransactionalEmailInput) {
  if (!canSendTransactionalEmail()) {
    return { sent: false, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getResendFromEmail(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || "Resend did not accept the email.");
  }

  return { sent: true, skipped: false };
}

function buildGreeting(fullName: string) {
  return fullName.trim() || "Hola";
}

export async function sendAccountApprovedEmail(input: {
  to: string;
  fullName: string;
}) {
  const greeting = buildGreeting(input.fullName);
  const loginUrl = `${getAppUrl()}/login`;

  return sendTransactionalEmail({
    to: input.to,
    subject: "Tu cuenta de ShiftSwap ya esta aprobada",
    html: `
      <p>${greeting},</p>
      <p>Tu cuenta ya esta activa y puedes entrar en ShiftSwap.</p>
      <p><a href="${loginUrl}">Ir al acceso</a></p>
    `,
    text: `${greeting}, tu cuenta ya esta activa. Accede en ${loginUrl}`,
  });
}

export async function sendAccountRejectedEmail(input: {
  to: string;
  fullName: string;
  notes: string;
}) {
  const greeting = buildGreeting(input.fullName);
  const reviewUrl = `${getAppUrl()}/pending-validation`;

  return sendTransactionalEmail({
    to: input.to,
    subject: "Tu solicitud de ShiftSwap necesita correcciones",
    html: `
      <p>${greeting},</p>
      <p>Tu solicitud necesita correcciones antes de poder activarse.</p>
      <p><strong>Observacion:</strong> ${input.notes}</p>
      <p><a href="${reviewUrl}">Revisar estado</a></p>
    `,
    text: `${greeting}, tu solicitud necesita correcciones. Observacion: ${input.notes}. Revisa ${reviewUrl}`,
  });
}
