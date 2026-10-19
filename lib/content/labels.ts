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

/** Titre lisible tiré d'un nom de fichier ("01-attacking-child-parents.md" -> "Attacking child parents"). */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.md$/i, "");
  // Les préfixes numériques ne servent qu'à ordonner les fiches dans la sidebar.
  const withoutOrder = base.replace(/^\d+[-_.\s]+/, "");
  return folderLabel(withoutOrder || base);
}

/** Supprime les blocs de code délimités (``` ou ~~~), dont le contenu ne doit pas être interprété. */
export function stripFencedCode(markdown: string): string {
  return markdown.replace(/^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1?\2[`~]*[ \t]*$|(?![\s\S]))/gm, "");
}

/**
 * Titre explicite d'une fiche : un H1 `# …` uniquement s'il ouvre la fiche (premier contenu
 * non vide). Un `# commentaire` dans un bloc de code ou un H1 de section plus bas ne compte pas.
 */
export function leadingTitle(markdown: string): string | null {
  const firstLine = markdown.split(/\r?\n/).find((line) => line.trim() !== "");
  const match = firstLine?.match(/^ {0,3}#[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/);
  return match ? match[1].trim() : null;
}

export function ficheTitle(markdown: string, filename: string): string {
  return leadingTitle(markdown) ?? titleFromFilename(filename);
}
