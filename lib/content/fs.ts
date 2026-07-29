import fs from "node:fs/promises";
import path from "node:path";
import { CONTENT_ROOT, InvalidPathError, resolveSafeFichePath, resolveSafeFolderPath } from "./paths";
import { slugify } from "./slugify";

export interface TreeFolder {
  type: "folder";
  name: string;
  path: string[];
  children: TreeNode[];
}

export interface TreeFiche {
  type: "fiche";
  name: string;
  title: string;
  path: string[];
}

export type TreeNode = TreeFolder | TreeFiche;

export function extractTitle(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

async function walk(dirAbs: string, relSegments: string[]): Promise<TreeNode[]> {
  const entries = await fs.readdir(dirAbs, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const segments = [...relSegments, entry.name];

    if (entry.isDirectory()) {
      const children = await walk(path.join(dirAbs, entry.name), segments);
      nodes.push({ type: "folder", name: entry.name, path: segments, children });
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const abs = path.join(dirAbs, entry.name);
      const content = await fs.readFile(abs, "utf-8");
      nodes.push({ type: "fiche", name: entry.name, title: extractTitle(content, entry.name), path: segments });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export async function listTree(): Promise<TreeNode[]> {
  await fs.mkdir(CONTENT_ROOT, { recursive: true });
  return walk(CONTENT_ROOT, []);
}

export interface FicheContent {
  content: string;
  title: string;
  mtimeMs: number;
}

export async function readFiche(segments: string[]): Promise<FicheContent> {
  const abs = resolveSafeFichePath(segments);
  const content = await fs.readFile(abs, "utf-8");
  const stat = await fs.stat(abs);
  return { content, title: extractTitle(content, segments[segments.length - 1]), mtimeMs: stat.mtimeMs };
}

export class ConflictError extends Error {}

/** Écrit une fiche existante après vérification optimiste du mtime (évite d'écraser une édition concurrente). */
export async function writeFiche(
  segments: string[],
  content: string,
  expectedMtimeMs: number,
): Promise<{ mtimeMs: number }> {
  const abs = resolveSafeFichePath(segments);
  const stat = await fs.stat(abs);
  if (stat.mtimeMs !== expectedMtimeMs) {
    throw new ConflictError("La fiche a été modifiée entre-temps");
  }

  await fs.writeFile(abs, content, "utf-8");
  const newStat = await fs.stat(abs);
  return { mtimeMs: newStat.mtimeMs };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function folderAbsPath(segments: string[]): string {
  return segments.length > 0 ? resolveSafeFolderPath(segments) : CONTENT_ROOT;
}

/** Écrit une nouvelle fiche dans folderSegments, en dérivant un nom de fichier slugifié unique à partir de slugBase. */
async function writeNewFiche(folderSegments: string[], slugBase: string, content: string): Promise<string[]> {
  const folderAbs = folderAbsPath(folderSegments);
  await fs.mkdir(folderAbs, { recursive: true });

  const base = slugify(slugBase);
  let filename = `${base}.md`;
  let counter = 2;
  while (await pathExists(path.join(folderAbs, filename))) {
    filename = `${base}-${counter}.md`;
    counter += 1;
  }

  const segments = [...folderSegments, filename];
  await fs.writeFile(resolveSafeFichePath(segments), content, "utf-8");
  return segments;
}

export function createFiche(folderSegments: string[], title: string, content: string): Promise<string[]> {
  return writeNewFiche(folderSegments, title, content);
}

export interface ImportEntry {
  /** Chemin relatif au dossier cible, filename inclus (ex: ["sous-dossier", "fiche.md"]). */
  relativePath: string[];
  content: string;
}

/**
 * Importe un lot de fiches (drag-and-drop de fichiers et/ou de dossiers), en conservant la
 * structure de sous-dossiers relative. Traité séquentiellement (pas Promise.all) pour que
 * l'anti-collision de writeNewFiche voie les fichiers déjà écrits plus tôt dans le même lot.
 */
export async function importFiches(baseFolder: string[], entries: ImportEntry[]): Promise<{ imported: string[][] }> {
  const imported: string[][] = [];
  for (const entry of entries) {
    const folderPart = entry.relativePath.slice(0, -1).map(slugify);
    const filename = entry.relativePath[entry.relativePath.length - 1];
    const segments = await writeNewFiche([...baseFolder, ...folderPart], filename.replace(/\.md$/i, ""), entry.content);
    imported.push(segments);
  }
  return { imported };
}

export async function createFolder(segments: string[]): Promise<void> {
  await fs.mkdir(resolveSafeFolderPath(segments), { recursive: true });
}

/** Renomme ou déplace une fiche ou un dossier. Refuse d'écraser une entrée existante à destination. */
export async function moveEntry(fromSegments: string[], toSegments: string[]): Promise<void> {
  const isFiche = fromSegments[fromSegments.length - 1]?.endsWith(".md") ?? false;
  const fromAbs = isFiche ? resolveSafeFichePath(fromSegments) : resolveSafeFolderPath(fromSegments);
  const toAbs = isFiche ? resolveSafeFichePath(toSegments) : resolveSafeFolderPath(toSegments);

  // Un dossier ne peut pas devenir son propre sous-dossier : fs.rename échouerait (EINVAL) de
  // toute façon, mais on le détecte nous-mêmes pour renvoyer une erreur propre plutôt qu'un crash.
  if (!isFiche && (toAbs === fromAbs || toAbs.startsWith(fromAbs + path.sep))) {
    throw new InvalidPathError("Impossible de déplacer un dossier dans lui-même ou l'un de ses sous-dossiers");
  }

  if (await pathExists(toAbs)) {
    throw new ConflictError("Une entrée existe déjà à cet emplacement");
  }

  await fs.mkdir(path.dirname(toAbs), { recursive: true });
  await fs.rename(fromAbs, toAbs);
}

/** Supprime une fiche, ou un dossier — le dossier doit être vide (ENOTEMPTY sinon, à charge de l'appelant de le traduire). */
export async function deleteEntry(segments: string[]): Promise<void> {
  const isFiche = segments[segments.length - 1]?.endsWith(".md") ?? false;
  if (isFiche) {
    await fs.unlink(resolveSafeFichePath(segments));
  } else {
    await fs.rmdir(resolveSafeFolderPath(segments));
  }
}
