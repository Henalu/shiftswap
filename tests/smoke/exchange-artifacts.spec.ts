import { expect, test } from "@playwright/test";
import {
  exchangeId,
  getArtifactCredentials,
  hasCredentials,
} from "./helpers/env";
import { loginAs, openAndExpectHeading } from "./helpers/session";

const artifactCredentials = getArtifactCredentials();

test.describe("exchange artifacts smoke", () => {
  test.skip(
    !exchangeId || !hasCredentials(artifactCredentials),
    "Configura E2E_EXCHANGE_ID y unas credenciales con acceso al expediente para validar detalle y PDFs."
  );

  test("an accessible exchange detail and both PDFs respond", async ({ page }) => {
    await loginAs(page, artifactCredentials!);

    await openAndExpectHeading(page, `/exchanges/${exchangeId}`, /Cambio|Expediente/i);

    const pdfResponse = await page.goto(`/api/exchanges/${exchangeId}/pdf`);
    expect(pdfResponse).not.toBeNull();
    expect(pdfResponse?.ok()).toBeTruthy();
    expect(pdfResponse?.headers()["content-type"]).toContain("application/pdf");

    const officialPdfResponse = await page.goto(
      `/api/exchanges/${exchangeId}/official-pdf`
    );
    expect(officialPdfResponse).not.toBeNull();
    expect(officialPdfResponse?.ok()).toBeTruthy();
    expect(officialPdfResponse?.headers()["content-type"]).toContain(
      "application/pdf"
    );
  });
});
