/**
 * Auto-detect variant types based on common patterns
 * Analyzes variant option values and identifies what they represent
 */

const GENERO_PATTERNS = [
  "hombre",
  "mujer",
  "niño",
  "niña",
  "unisex",
  "masculino",
  "femenino",
  "infantil",
  "adulto",
];

const TALLA_PATTERNS = [
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "xxl",
  "xxxl",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
  "50",
  "p",
  "m",
  "g",
  "gg",
  "ggg",
  "talla unica",
];

const COLOR_PATTERNS = [
  "negro",
  "blanco",
  "rojo",
  "azul",
  "verde",
  "amarillo",
  "naranja",
  "rosa",
  "morado",
  "gris",
  "marrón",
  "beige",
  "café",
  "marino",
  "turquesa",
  "violeta",
  "plateado",
  "dorado",
  "crema",
  "marfil",
  "arena",
  "caqui",
  "índigo",
];

function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove accents
}

function matchesPattern(value: string, patterns: string[]): boolean {
  const normalized = normalizeValue(value);
  return patterns.some((pattern) => normalized.includes(pattern));
}

export type VariantType = "genero" | "color" | "talla" | "unknown";

export function detectVariantType(value: string): VariantType {
  if (matchesPattern(value, GENERO_PATTERNS)) return "genero";
  if (matchesPattern(value, TALLA_PATTERNS)) return "talla";
  if (matchesPattern(value, COLOR_PATTERNS)) return "color";
  return "unknown";
}

/**
 * Auto-detect variant positions from variant_title
 * Returns indices for [genero, color, talla], or undefined if not found
 *
 * Example: "Hombre / Azul Marino / M" → [0, 1, 2]
 * Example: "Azul / M" → [undefined, 0, 1]
 */
export function detectVariantPositions(
  variantTitle: string
): {
  genero?: number;
  color?: number;
  talla?: number;
} {
  const parts = variantTitle.split(" / ");
  const detected: {
    genero?: number;
    color?: number;
    talla?: number;
  } = {};

  parts.forEach((part, index) => {
    const type = detectVariantType(part);
    if (type !== "unknown") {
      detected[type] = index;
    }
  });

  return detected;
}
