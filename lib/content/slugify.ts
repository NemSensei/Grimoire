/** Translittère un titre libre (accents FR compris) en slug ASCII sûr pour un nom de fichier/dossier. */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marques diacritiques combinantes (accents)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "sans-titre";
}
