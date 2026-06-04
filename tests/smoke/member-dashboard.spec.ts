import { expect, test } from "@playwright/test";
import { hasCredentials, memberCredentials } from "./helpers/env";
import {
  expectNoFrameworkError,
  loginAs,
  openAndExpectHeading,
  openAndExpectText,
} from "./helpers/session";

test.describe("member dashboard smoke", () => {
  test.skip(
    !hasCredentials(memberCredentials),
    "Configura E2E_MEMBER_EMAIL y E2E_MEMBER_PASSWORD para ejecutar el smoke de miembro."
  );

  test("member can reach core work surfaces", async ({ page }) => {
    await loginAs(page, memberCredentials!);

    await openAndExpectHeading(page, "/shifts", /Turnos disponibles/i);
    await openAndExpectHeading(page, "/shifts/new", /Publicar nuevo turno/i);
    await openAndExpectHeading(page, "/calendar", /^Calendario$/i);
    await openAndExpectHeading(page, "/calendar/vacations", /^Vacaciones$/i);
    await openAndExpectHeading(page, "/exchanges", /Cambios|Expedientes/i);
    await openAndExpectText(page, "/billing", /Suscripcion y acceso/i);
    await openAndExpectHeading(page, "/help", /Ayuda|preguntas frecuentes/i);
    await openAndExpectHeading(page, "/profile", /Mi perfil|Perfil/i);
  });

  test("home fits the mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, memberCredentials!);

    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expectNoFrameworkError(page);
    await expect(page.getByRole("heading", { name: /Hola,/i }).first()).toBeVisible();

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      const main = document.querySelector("main");

      return {
        viewportWidth: root.clientWidth,
        documentWidth: root.scrollWidth,
        mainClientWidth: main?.clientWidth ?? 0,
        mainScrollWidth: main?.scrollWidth ?? 0,
      };
    });

    expect(overflow.documentWidth).toBeLessThanOrEqual(
      overflow.viewportWidth + 1
    );
    expect(overflow.mainScrollWidth).toBeLessThanOrEqual(
      overflow.mainClientWidth + 1
    );
  });
});
