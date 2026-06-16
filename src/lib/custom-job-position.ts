const CUSTOM_JOB_POSITION_ALLOWED_PATTERN =
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;

const DIACRITIC_MARKS_PATTERN = /[\u0300-\u036f]/g;

const FORBIDDEN_CUSTOM_JOB_POSITION_WORDS = new Set([
  "cabron",
  "cojones",
  "cono",
  "culo",
  "gilipollas",
  "hijoputa",
  "joder",
  "maricon",
  "mierda",
  "polla",
  "puta",
  "putas",
  "puto",
  "putos",
  "zorra",
]);

export const CUSTOM_JOB_POSITION_INPUT_PATTERN =
  "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+";
export const CUSTOM_JOB_POSITION_MAX_LENGTH = 80;
export const CUSTOM_JOB_POSITION_MIN_LENGTH = 2;

export function normalizeCustomJobPositionName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeForGuardrail(value: string) {
  return normalizeCustomJobPositionName(value)
    .normalize("NFD")
    .replace(DIACRITIC_MARKS_PATTERN, "")
    .toLowerCase();
}

export function getCustomJobPositionNameError(value: string) {
  const normalizedName = normalizeCustomJobPositionName(value);

  if (!normalizedName) {
    return "Escribe el nombre del puesto.";
  }

  if (normalizedName.length < CUSTOM_JOB_POSITION_MIN_LENGTH) {
    return "El puesto debe tener al menos 2 letras.";
  }

  if (normalizedName.length > CUSTOM_JOB_POSITION_MAX_LENGTH) {
    return "El puesto no puede superar los 80 caracteres.";
  }

  if (!CUSTOM_JOB_POSITION_ALLOWED_PATTERN.test(normalizedName)) {
    return "El puesto solo puede contener letras y espacios.";
  }

  const words = normalizeForGuardrail(normalizedName).split(" ");
  if (words.some((word) => FORBIDDEN_CUSTOM_JOB_POSITION_WORDS.has(word))) {
    return "Ese nombre de puesto no es valido. Usa un nombre profesional.";
  }

  return null;
}
