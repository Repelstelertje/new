export function slugifyName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Bouw de canonieke interne profiel-URL, altijd met trailing slash. */
export function buildProfileHref(name: string, id: string | number) {
  const slug = slugifyName(name);
  return `/daten-met-${slug}/?id=${encodeURIComponent(String(id))}`;
}
