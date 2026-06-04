export type PasswordPolicyError =
  | "password-missing-letter"
  | "password-missing-number"
  | "password-too-short";

export type PasswordPolicyResult =
  | { ok: true }
  | {
      error: PasswordPolicyError;
      ok: false;
    };

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < 8) {
    return { error: "password-too-short", ok: false };
  }

  if (!/[A-Za-z]/.test(password)) {
    return { error: "password-missing-letter", ok: false };
  }

  if (!/[0-9]/.test(password)) {
    return { error: "password-missing-number", ok: false };
  }

  return { ok: true };
}

export function getPasswordPolicyMessage(error: PasswordPolicyError) {
  switch (error) {
    case "password-missing-letter":
      return "La contrasena debe incluir al menos una letra.";
    case "password-missing-number":
      return "La contrasena debe incluir al menos un numero.";
    case "password-too-short":
      return "La contrasena debe tener al menos 8 caracteres.";
  }
}
