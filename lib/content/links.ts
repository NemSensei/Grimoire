import { slugify } from "./slugify";
import { stripFencedCode } from "./labels";

/**
 * Liens entre fiches façon Obsidian : `[[cible]]`, `[[cible#Section]]`, `[[cible|libellé]]`.
 * La cible peut être le nom de fichier (sans .md), le chemin (`web/sqlmap-cheatsheet`) ou le
 * titre de la fiche — insensible à la casse et aux accents.
 */
export const WIKILINK_RE = /\[\[([^[\]|#\n]+)(?:#([^[\]|\n]+))?(?:\|([^[\]\n]+))?\]\]/g;

export interface LinkableFiche {
  path: string[];
  title: string;
}

export interface LinkIndex {
  resolve(target: string): LinkableFiche | null;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function pathKey(path: string[]): string {
  return path.join("/").replace(/\.md$/, "");
}

export function buildLinkIndex(fiches: LinkableFiche[]): LinkIndex {
  const byPath = new Map<string, LinkableFiche>();
  const byName = new Map<string, LinkableFiche>();
  const byTitle = new Map<string, LinkableFiche>();

  // Ordre de la sidebar : en cas d'homonymes, la première fiche rencontrée l'emporte.
  for (const fiche of fiches) {
    byPath.set(pathKey(fiche.path), fiche);
    const name = fiche.path[fiche.path.length - 1].replace(/\.md$/, "");
    if (!byName.has(name)) byName.set(name, fiche);
    const title = normalize(fiche.title);
    if (!byTitle.has(title)) byTitle.set(title, fiche);
  }

  return {
    resolve(target) {
      const cleaned = target.trim().replace(/^\/+/, "").replace(/\.md$/i, "");
      return (
        byPath.get(cleaned.toLowerCase()) ??
        byName.get(cleaned.toLowerCase()) ??
        byTitle.get(normalize(cleaned)) ??
        byName.get(slugify(cleaned)) ??
        null
      );
    },
  };
}

/** Cible à insérer pour lier une fiche : son nom de fichier, ou son chemin s'il est ambigu. */
export function linkTargetFor(fiche: LinkableFiche, all: LinkableFiche[]): string {
  const name = fiche.path[fiche.path.length - 1].replace(/\.md$/, "");
  const homonyms = all.filter((f) => f.path[f.path.length - 1] === fiche.path[fiche.path.length - 1]);
  return homonyms.length > 1 ? pathKey(fiche.path) : name;
}

/** Approximation de l'algorithme de github-slugger utilisé par rehype-slug pour les id de titres. */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** Cibles (chemins) des liens sortants d'une fiche : `[[…]]` et liens Markdown vers /fiche/…. */
export function extractLinkedPaths(markdown: string, index: LinkIndex): string[][] {
  const text = stripFencedCode(markdown).replace(/`[^`\n]*`/g, "");
  const found = new Map<string, string[]>();

  for (const match of text.matchAll(WIKILINK_RE)) {
    const fiche = index.resolve(match[1]);
    if (fiche) found.set(fiche.path.join("/"), fiche.path);
  }
  for (const match of text.matchAll(/\]\(\/fiche\/([^)\s#?]+)/g)) {
    const segments = match[1].split("/").map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
    found.set(segments.join("/"), segments);
  }

  return [...found.values()];
}
