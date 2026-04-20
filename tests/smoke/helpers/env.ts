export interface SmokeCredentials {
  email: string;
  password: string;
}

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
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
export const adminCredentials = readCredentials("E2E_ADMIN");
export const superAdminCredentials = readCredentials("E2E_SUPER_ADMIN");
export const exchangeId = readEnv("E2E_EXCHANGE_ID");

export function hasCredentials(
  credentials: SmokeCredentials | null
): credentials is SmokeCredentials {
  return Boolean(credentials?.email && credentials.password);
}

export function getArtifactCredentials() {
  return superAdminCredentials ?? adminCredentials ?? memberCredentials;
}
