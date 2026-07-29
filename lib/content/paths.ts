import path from "node:path";

export const CONTENT_ROOT = path.resolve(process.env.CONTENT_DIR ?? "./content");

const SEGMENT_RE = /^[a-z0-9._-]+$/;

export class InvalidPathError extends Error {}

function assertValidSegment(segment: string): void {
  if (
    segment.length === 0 ||
    segment === "." ||
    segment === ".." ||
    segment.includes("/") ||
    segment.includes("\\") ||
    segment.includes("\0") ||
    !SEGMENT_RE.test(segment)
  ) {
    throw new InvalidPathError(`Segment de chemin invalide : "${segment}"`);
  }
}

/** Résout des segments de chemin utilisateur vers un chemin absolu garanti sous CONTENT_ROOT. */
export function resolveSafePath(segments: string[]): string {
  if (segments.length === 0) {
    throw new InvalidPathError("Chemin vide");
  }
  segments.forEach(assertValidSegment);

  const resolved = path.resolve(CONTENT_ROOT, ...segments);
  if (resolved !== CONTENT_ROOT && !resolved.startsWith(CONTENT_ROOT + path.sep)) {
    throw new InvalidPathError("Chemin hors de CONTENT_ROOT");
  }
  return resolved;
}

/** Comme resolveSafePath, mais impose que le dernier segment soit une fiche .md. */
export function resolveSafeFichePath(segments: string[]): string {
  const last = segments[segments.length - 1];
  if (!last || !last.endsWith(".md")) {
    throw new InvalidPathError("Une fiche doit se terminer par .md");
  }
  return resolveSafePath(segments);
}

/** Comme resolveSafePath, mais interdit les points dans les noms de dossier. */
export function resolveSafeFolderPath(segments: string[]): string {
  segments.forEach((segment) => {
    if (segment.includes(".")) {
      throw new InvalidPathError("Un nom de dossier ne peut pas contenir de point");
    }
  });
  return resolveSafePath(segments);
}
