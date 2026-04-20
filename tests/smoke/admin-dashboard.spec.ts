import { test } from "@playwright/test";
import {
  adminCredentials,
  hasCredentials,
  superAdminCredentials,
} from "./helpers/env";
import { loginAs, openAndExpectHeading } from "./helpers/session";

test.describe("admin dashboard smoke", () => {
  test.skip(
    !hasCredentials(adminCredentials),
    "Configura E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD para ejecutar el smoke admin."
  );

  test("admin can reach operational review queues", async ({ page }) => {
    await loginAs(page, adminCredentials!);

    await openAndExpectHeading(page, "/admin/exchanges", /Aprobaciones de cambios/i);
    await openAndExpectHeading(
      page,
      "/admin/validations",
      /Validaciones de empleados/i
    );
    await openAndExpectHeading(
      page,
      "/admin/department-changes",
      /Cambios de departamento/i
    );
    await openAndExpectHeading(
      page,
      "/admin/job-position-changes",
      /Cambios de puesto/i
    );
    await openAndExpectHeading(page, "/admin/schedule-config", /^Calendarios$/i);
  });
});

test.describe("super admin smoke", () => {
  test.skip(
    !hasCredentials(superAdminCredentials),
    "Configura E2E_SUPER_ADMIN_EMAIL y E2E_SUPER_ADMIN_PASSWORD para validar la gestion de roles."
  );

  test("super admin can reach user role management", async ({ page }) => {
    await loginAs(page, superAdminCredentials!);
    await openAndExpectHeading(page, "/admin/users", /Roles de usuario/i);
  });
});
