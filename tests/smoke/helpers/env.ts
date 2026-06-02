import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface SmokeCredentials {
  email: string;
  password: string;
}

function readEnvFile() {
  try {
    const envPath = join(process.cwd(), ".env.local");

    if (!existsSync(envPath)) {
      return new Map<string, string>();
    }

    const values = new Map<string, string>();
    const content = readFileSync(envPath, "utf8");

    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

      if (!match) {
        return;
      }

      const [, name, rawValue] = match;
      let value = rawValue.trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (value) {
        values.set(name, value);
      }
    });

    return values;
  } catch {
    return new Map<string, string>();
  }
}

const envFileValues = readEnvFile();

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim() || envFileValues.get(name)?.trim();

  return value ? value : null;
}

function readCredentials(prefix: string): SmokeCredentials | null {
  const email = readEnv(`${prefix}_EMAIL`);
  const password = readEnv(`${prefix}_PASSWORD`);

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

export const memberCredentials = readCredentials("E2E_MEMBER");
export const departmentAdminCredentials =
  readCredentials("E2E_DEPARTMENT_ADMIN") ?? readCredentials("E2E_ADMIN");
export const hrAdminCredentials = readCredentials("E2E_HR_ADMIN");
export const adminCredentials =
  departmentAdminCredentials ?? hrAdminCredentials;
export const superAdminCredentials = readCredentials("E2E_SUPER_ADMIN");
export const unrelatedCredentials = readCredentials("E2E_UNRELATED");
export const exchangeId = readEnv("E2E_EXCHANGE_ID");

export function hasCredentials(
  credentials: SmokeCredentials | null
): credentials is SmokeCredentials {
  return Boolean(credentials?.email && credentials.password);
}

export function getArtifactCredentials() {
  return (
    superAdminCredentials ??
    hrAdminCredentials ??
    departmentAdminCredentials ??
    memberCredentials
  );
}
