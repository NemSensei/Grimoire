/** Nom lisible d'un dossier à partir de son slug ("d1-domain-trust" -> "D1 domain trust"). */
export function folderLabel(name: string): string {
  const spaced = name.replace(/[-_]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function ficheHref(path: string[]): string {
  return `/fiche/${path.map(encodeURIComponent).join("/")}`;
}

export function editHref(path: string[]): string {
  return `/edit/${path.map(encodeURIComponent).join("/")}`;
}
