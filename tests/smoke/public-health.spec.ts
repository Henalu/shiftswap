import { expect, test } from "@playwright/test";

test("health endpoint reports database readiness", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  expect(payload.ok).toBe(true);
  expect(payload.database).toBe("up");
  expect(typeof payload.timestamp).toBe("string");
});
