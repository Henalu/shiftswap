import { expect, test } from "@playwright/test";
import {
  exchangeId,
  hasCredentials,
  memberCredentials,
  unrelatedCredentials,
} from "./helpers/env";
import {
  expectNoFrameworkError,
  loginAs,
  openAndExpectRedirect,
} from "./helpers/session";

test.describe("member permission smoke", () => {
  test.skip(
    !hasCredentials(memberCredentials),
    "Configura E2E_MEMBER_EMAIL y E2E_MEMBER_PASSWORD para ejecutar smokes negativos de permisos."
  );

  test("member cannot reach exchange approval admin", async ({ page }) => {
    await loginAs(page, memberCredentials!);

    await openAndExpectRedirect(
      page,
      "/admin/exchanges",
      "/shifts",
      /Turnos disponibles/i
    );
  });

  test("member cannot reach user role management", async ({ page }) => {
    await loginAs(page, memberCredentials!);

    await openAndExpectRedirect(
      page,
      "/admin/users",
      "/shifts",
      /Turnos disponibles/i
    );
  });
});

test.describe("exchange PDF permission smoke", () => {
  test.skip(
    !exchangeId || !hasCredentials(unrelatedCredentials),
    "Configura E2E_EXCHANGE_ID y E2E_UNRELATED_EMAIL/PASSWORD para validar rechazo de PDFs a un usuario sin relacion."
  );

  for (const artifactPath of ["pdf", "official-pdf"] as const) {
    test(`unrelated member cannot download ${artifactPath}`, async ({ page }) => {
      await loginAs(page, unrelatedCredentials!);

      const response = await page.goto(
        `/api/exchanges/${exchangeId}/${artifactPath}`,
        { waitUntil: "domcontentloaded" }
      );

      await expectNoFrameworkError(page);
      expect(response).not.toBeNull();
      expect(response?.status()).toBe(404);
      expect(response?.headers()["content-type"] ?? "").not.toContain(
        "application/pdf"
      );
    });
  }
});
