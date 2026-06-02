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

    const pdfResponse = await page.request.get(
      `/api/exchanges/${exchangeId}/pdf`
    );
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

    const officialPdfResponse = await page.request.get(
      `/api/exchanges/${exchangeId}/official-pdf`
    );
    expect(officialPdfResponse.ok()).toBeTruthy();
    expect(officialPdfResponse.headers()["content-type"]).toContain(
      "application/pdf"
    );
  });
});
