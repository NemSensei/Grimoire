import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { CONTENT_ROOT } from "./paths";

/**
 * Historique des fiches : `content/` est un dépôt git interne, géré uniquement par l'application.
 * Chaque mutation est commitée au nom de l'utilisateur connecté (cf. lib/content/after-mutation.ts).
 *
 * - git est appelé via execFile (jamais de shell) avec des arguments construits par nous ; les
 *   chemins viennent de segments déjà validés par lib/content/paths.ts.
 * - La configuration git de la machine est ignorée (GIT_CONFIG_GLOBAL/NOSYSTEM) : pas de hooks,
 *   de signature GPG ou d'identité héritée de l'hôte.
 * - Si git est absent, l'historique est simplement désactivé : l'application reste utilisable.
 */

const SHA_RE = /^[0-9a-f]{7,40}$/;
const FIELD = "\x1f";
const RECORD = "\x1e";
const LOG_FORMAT = `--format=${RECORD}%H${FIELD}%an${FIELD}%at${FIELD}%s`;

export class HistoryUnavailableError extends Error {}

const holder = globalThis as { __grimoireGitQueue?: Promise<unknown>; __grimoireGitState?: "ok" | "missing" };

function runGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [
        "-c", "core.hooksPath=/dev/null",
        "-c", "commit.gpgSign=false",
        "-c", "core.quotePath=false",
        "-c", `safe.directory=${CONTENT_ROOT}`,
        "-c", "user.name=Grimoire",
        "-c", "user.email=grimoire@localhost",
        ...args,
      ],
      {
        cwd: CONTENT_ROOT,
        maxBuffer: 32 * 1024 * 1024,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: process.env.NODE_ENV,
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_TERMINAL_PROMPT: "0",
          LANG: "C",
        },
      },
      (error, stdout) => {
        if (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") holder.__grimoireGitState = "missing";
          reject(error);
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

/** Sérialise les commandes git du process : deux commits simultanés se battraient pour index.lock. */
function git(args: string[]): Promise<string> {
  const run = (holder.__grimoireGitQueue ?? Promise.resolve()).catch(() => undefined).then(() => runGit(args));
  holder.__grimoireGitQueue = run;
  return run;
}

export function historyAvailable(): boolean {
  return holder.__grimoireGitState !== "missing";
}

async function ensureRepo(): Promise<void> {
  try {
    await fs.access(path.join(CONTENT_ROOT, ".git"));
  } catch {
    await fs.mkdir(CONTENT_ROOT, { recursive: true });
    await git(["init", "-q", "-b", "main"]);
  }
}

/**
 * Commite tout changement en attente dans content/ (add -A capte aussi déplacements, suppressions
 * et images). Ne lève jamais : les données sont déjà écrites, un échec d'historique est seulement
 * journalisé.
 */
export async function commitAll(author: string, message: string): Promise<void> {
  if (!historyAvailable()) return;
  try {
    await ensureRepo();
    await git(["add", "-A"]);
    const status = await git(["status", "--porcelain"]);
    if (status.trim() === "") return;
    const safeAuthor = author.replace(/[<>\n]/g, "") || "inconnu";
    await git(["commit", "-q", "--no-verify", `--author=${safeAuthor} <${safeAuthor}@grimoire>`, "-m", message]);
  } catch (error) {
    console.error("[historique] commit impossible :", error instanceof Error ? error.message : error);
  }
}

export interface Revision {
  sha: string;
  author: string;
  date: number;
  message: string;
}

export interface FileRevision extends Revision {
  /** Chemin de la fiche dans cette version (la fiche a pu être renommée ou déplacée depuis). */
  path: string;
}

export interface ActivityEntry extends Revision {
  files: { status: string; path: string }[];
}

function parseHeader(header: string): Revision {
  const [sha, author, at, message] = header.split(FIELD);
  return { sha, author, date: Number(at) * 1000, message };
}

/** Découpe une sortie `git log` (LOG_FORMAT + --name-only/--name-status) en enregistrements. */
function parseLog(output: string): { revision: Revision; lines: string[] }[] {
  return output
    .split(RECORD)
    .filter((chunk) => chunk.trim() !== "")
    .map((chunk) => {
      const [header, ...rest] = chunk.split("\n");
      return { revision: parseHeader(header), lines: rest.filter((l) => l.trim() !== "") };
    });
}

function relative(segments: string[]): string {
  return segments.join("/");
}

async function readLog(args: string[]): Promise<string> {
  if (!historyAvailable()) throw new HistoryUnavailableError("git n'est pas installé sur le serveur");
  try {
    await ensureRepo();
    return await git(["log", LOG_FORMAT, ...args]);
  } catch (error) {
    // Dépôt sans aucun commit : historique vide plutôt qu'une erreur.
    if (/does not have any commits|bad default revision/.test(String((error as Error).message))) return "";
    if (!historyAvailable()) throw new HistoryUnavailableError("git n'est pas installé sur le serveur");
    throw error;
  }
}

/** Versions d'une fiche, de la plus récente à la plus ancienne, en suivant les renommages. */
export async function fileHistory(segments: string[]): Promise<FileRevision[]> {
  const output = await readLog(["--follow", "--name-only", "-M", "--", relative(segments)]);
  return parseLog(output).map(({ revision, lines }) => ({ ...revision, path: lines[0] ?? relative(segments) }));
}

/** Différences introduites par `sha` sur la fiche (patch unifié). */
export async function revisionDiff(sha: string, paths: string[]): Promise<string> {
  assertSha(sha);
  return git(["show", "--format=", "--no-color", "-M", "--no-ext-diff", sha, "--", ...new Set(paths)]);
}

/** Contenu d'un fichier tel qu'il était dans la version `sha` (ou juste avant elle, avec `beforeSha`). */
export async function fileAt(sha: string, relPath: string, beforeSha = false): Promise<string> {
  assertSha(sha);
  return git(["show", `${sha}${beforeSha ? "^" : ""}:${relPath}`]);
}

/** Derniers changements, toutes fiches confondues. */
export async function recentActivity(limit = 40): Promise<ActivityEntry[]> {
  const output = await readLog([`-n${limit}`, "--name-status", "-M"]);
  return parseLog(output).map(({ revision, lines }) => ({
    ...revision,
    files: lines.map((line) => {
      const parts = line.split("\t");
      return { status: parts[0].charAt(0), path: parts[parts.length - 1] };
    }),
  }));
}

export interface DeletedFiche extends Revision {
  path: string;
}

/** Fiches supprimées (et pas recréées depuis), avec la version qui les a supprimées. */
export async function deletedFiches(exists: (relPath: string) => boolean, limit = 50): Promise<DeletedFiche[]> {
  const output = await readLog(["--diff-filter=D", "--name-only", "--", "*.md"]);
  const seen = new Set<string>();
  const result: DeletedFiche[] = [];
  for (const { revision, lines } of parseLog(output)) {
    for (const relPath of lines) {
      if (seen.has(relPath) || exists(relPath)) continue;
      seen.add(relPath);
      result.push({ ...revision, path: relPath });
    }
    if (result.length >= limit) break;
  }
  return result;
}

export function assertSha(sha: string): void {
  if (!SHA_RE.test(sha)) throw new Error("Identifiant de version invalide");
}
