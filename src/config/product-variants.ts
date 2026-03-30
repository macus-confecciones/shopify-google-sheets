/**
 * Product variant mapping configuration
 * Maps product titles to their variant option positions
 *
 * For each product, specify which position (0-indexed) contains which attribute:
 * - genero: Gender (Hombre, Mujer, Niño, etc.)
 * - color: Color name
 * - talla: Size (S, M, L, XL, etc.)
 *
 * Example:
 * "Overol Gabardina": { genero: 0, color: 1, talla: 2 }
 * means: variant_title is "Hombre / Azul / M" → split by " / " and map positions
 *
 * If a product doesn't have a variant (e.g., a service), omit it from the config
 */

export type VariantMapping = {
  genero?: number;
  color?: number;
  talla?: number;
};

export const productVariantMap: Record<string, VariantMapping> = {
  // Add entries as you discover product variants
  // Example (uncomment and customize):
  // "Overol Gabardina": { genero: 0, color: 1, talla: 2 },
  // "Cortaviento Limos TW": { color: 0, talla: 1 }, // no genero variant
  // "Buzo Basico": { talla: 0, color: 1, genero: 2 }, // different order
};

/**
 * Get variant mapping for a product
 * Returns mapping if found, otherwise returns empty object (no variants)
 */
export function getVariantMapping(productTitle: string): VariantMapping {
  // Try exact match first
  if (productVariantMap[productTitle]) {
    return productVariantMap[productTitle];
  }

  // Try prefix match (useful if product title includes size/color in the name)
  for (const [key, mapping] of Object.entries(productVariantMap)) {
    if (productTitle.startsWith(key)) {
      return mapping;
    }
  }

  // No mapping found — return empty object
  // This means variant columns will be empty, but the order still processes
  return {};
}
