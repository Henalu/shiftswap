import { expect, type Page } from "@playwright/test";
import type { SmokeCredentials } from "./env";

export async function loginAs(page: Page, credentials: SmokeCredentials) {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /Iniciar sesion/i })
  ).toBeVisible();

  await page.getByLabel(/Email corporativo/i).fill(credentials.email);
  await page.getByLabel(/Contrasena/i).fill(credentials.password);
  await page.getByRole("button", { name: /Entrar/i }).click();

  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
}

export async function openAndExpectHeading(
  page: Page,
  path: string,
  heading: RegExp
) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
}
