import { test } from "@playwright/test";
import { hasCredentials, memberCredentials } from "./helpers/env";
import {
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
});
