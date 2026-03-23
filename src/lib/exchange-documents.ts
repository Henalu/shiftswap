export const EXCHANGE_DOCUMENT_TEMPLATE_ASSET_PATH = [
  "public",
  "templates",
  "cambio-de-turno.docx",
];
export const EXCHANGE_DOCUMENT_TEMPLATE_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const EXCHANGE_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;

export const EXCHANGE_DOCUMENT_ALLOWED_KINDS = [
  {
    extension: "pdf",
    mimeType: "application/pdf",
    label: "PDF",
  },
  {
    extension: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word (.docx)",
  },
  {
    extension: "doc",
    mimeType: "application/msword",
    label: "Word (.doc)",
  },
] as const;

export const EXCHANGE_DOCUMENT_INPUT_ACCEPT = [
  ".pdf",
  ".docx",
  ".doc",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
].join(",");

export interface ExchangeDocumentKind {
  extension: (typeof EXCHANGE_DOCUMENT_ALLOWED_KINDS)[number]["extension"];
  mimeType: (typeof EXCHANGE_DOCUMENT_ALLOWED_KINDS)[number]["mimeType"];
  label: (typeof EXCHANGE_DOCUMENT_ALLOWED_KINDS)[number]["label"];
}

export function getExchangeDocumentKind(file: {
  name: string;
  type?: string | null;
}): ExchangeDocumentKind | null {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type?.toLowerCase() ?? "";

  return (
    EXCHANGE_DOCUMENT_ALLOWED_KINDS.find(
      (kind) =>
        fileName.endsWith(`.${kind.extension}`) || mimeType === kind.mimeType
    ) ?? null
  );
}

export function getExchangeDocumentStoragePath(
  exchangeId: string,
  extension: ExchangeDocumentKind["extension"]
): string {
  return `${exchangeId}/document.${extension}`;
}

export function getExchangeTemplateDownloadName(exchangeId: string): string {
  return `cambio-de-turno-${exchangeId.slice(0, 8)}.docx`;
}

export function getExchangePdfDownloadName(exchangeId: string): string {
  return `solicitud-cambio-turno-${exchangeId.slice(0, 8)}.pdf`;
}
