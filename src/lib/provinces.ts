export const PROVINCES = [
  "Drenthe",
  "Flevoland",
  "Friesland",
  "Gelderland",
  "Groningen",
  "Limburg",
  "Noord-Brabant",
  "Noord-Holland",
  "Overijssel",
  "Utrecht",
  "Zeeland",
  "Zuid-Holland",
] as const;

export type ProvinceName = (typeof PROVINCES)[number];

export function provinceToSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function canonicalProvince(input: string) {
  const inputSlug = provinceToSlug(input);
  for (const name of PROVINCES) {
    if (provinceToSlug(name) === inputSlug) return name; // exact-cased naam
  }
  return input; // fallback
}
