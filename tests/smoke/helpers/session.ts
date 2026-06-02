import { expect, type Page } from "@playwright/test";
import type { SmokeCredentials } from "./env";

export async function loginAs(page: Page, credentials: SmokeCredentials) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Iniciar sesion/i).first()).toBeVisible();

  await page.getByLabel(/Email corporativo/i).fill(credentials.email);
  await page.getByLabel(/Contrasena/i).fill(credentials.password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      waitUntil: "domcontentloaded",
    }),
    page.getByRole("button", { name: /Entrar/i }).click(),
  ]);
  await page.waitForLoadState("domcontentloaded");
  await expectNoFrameworkError(page);
}

export async function openAndExpectHeading(
  page: Page,
  path: string,
  heading: RegExp
) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expectNoFrameworkError(page);
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
}

export async function openAndExpectText(
  page: Page,
  path: string,
  text: RegExp
) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expectNoFrameworkError(page);
  await expect(page.getByText(text).first()).toBeVisible();
}

export async function openAndExpectRedirect(
  page: Page,
  path: string,
  expectedPath: string,
  heading?: RegExp
) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForURL((url) => url.pathname === expectedPath, {
    waitUntil: "domcontentloaded",
  });
  await expectNoFrameworkError(page);

  if (heading) {
    await expect(
      page.getByRole("heading", { name: heading }).first()
    ).toBeVisible();
  }
}

export async function expectNoFrameworkError(page: Page) {
  const frameworkErrorOverlay = page
    .locator("[data-nextjs-dialog], .vite-error-overlay")
    .filter({
      hasText:
        /Application error|Build Error|Failed to compile|Runtime Error|Unhandled Runtime Error|hydration/i,
    });

  await expect(frameworkErrorOverlay).toHaveCount(0);
}
