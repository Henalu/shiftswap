import { expect, test } from "@playwright/test";
import {
  adminCredentials,
  hasCredentials,
  superAdminCredentials,
} from "./helpers/env";
import { loginAs, openAndExpectHeading } from "./helpers/session";

test.describe("admin dashboard smoke", () => {
  test.skip(
    !hasCredentials(adminCredentials),
    "Configura E2E_DEPARTMENT_ADMIN_* o E2E_HR_ADMIN_* para ejecutar el smoke admin. E2E_ADMIN_* sigue soportado como alias local."
  );

  test("admin can reach operational review queues", async ({ page }) => {
    await loginAs(page, adminCredentials!);

    await openAndExpectHeading(page, "/admin/exchanges", /Cambios informados/i);
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

  test("admin can filter schedule config on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.localStorage.setItem("shiftswap_guided_help_seen_v1", "true");
    });
    await loginAs(page, adminCredentials!);

    await openAndExpectHeading(page, "/admin/schedule-config", /^Calendarios$/i);
    const skipTourButton = page.getByRole("button", { name: "Saltar" });
    if (await skipTourButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipTourButton.click();
    }

    const searchInput = page.locator("#schedule-filter-q");
    const typeSelect = page.locator("#schedule-filter-type");

    await expect(searchInput).toBeVisible();
    await expect(typeSelect).toBeVisible();

    await searchInput.fill("zzzz-no-calendar-match");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page).toHaveURL(
      /\/admin\/schedule-config\?q=zzzz-no-calendar-match/
    );

    await expect(page.getByText("Sin areas con esos filtros")).toBeVisible();
    await expect(page.getByRole("link", { name: "Limpiar filtros" })).toBeVisible();
  });
});

test.describe("super admin smoke", () => {
  test.skip(
    !hasCredentials(superAdminCredentials),
    "Configura E2E_SUPER_ADMIN_EMAIL y E2E_SUPER_ADMIN_PASSWORD para validar la gestion de roles."
  );

  test("super admin can reach user role management", async ({ page }) => {
    await loginAs(page, superAdminCredentials!);
    await openAndExpectHeading(page, "/admin/platform", /Panel de plataforma/i);
    await openAndExpectHeading(page, "/admin/users", /Roles de usuario/i);
  });

  test("super admin sees mobile platform organizations without overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.localStorage.setItem("shiftswap_guided_help_seen_v1", "true");
    });
    await loginAs(page, superAdminCredentials!);

    await openAndExpectHeading(page, "/admin/platform", /Panel de plataforma/i);
    await expect(
      page.getByText("Usuarios, actividad mensual y estado comercial por empresa.")
    ).toBeVisible();
    await expect(page.locator("table")).toBeHidden();

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;

      return {
        documentWidth: root.scrollWidth,
        viewportWidth: root.clientWidth,
      };
    });

    expect(overflow.documentWidth).toBeLessThanOrEqual(
      overflow.viewportWidth + 1
    );
  });
});
