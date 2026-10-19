import { getDb } from "./client";
import { flattenFiches, listTree, readFiche } from "@/lib/content/fs";
import { SNIPPET_MARK_START, SNIPPET_MARK_END } from "@/lib/search-marks";
import { buildLinkIndex, extractLinkedPaths } from "@/lib/content/links";

export { SNIPPET_MARK_START, SNIPPET_MARK_END };

export interface SearchResult {
  path: string[];
  title: string;
  folder: string;
  snippet: string;
}

/**
 * Reconstruit entièrement l'index de recherche et la table des liens à partir du filesystem
 * (source de vérité).
 * Appelé au démarrage et après chaque mutation — volume attendu (quelques centaines de fiches)
 * assez faible pour qu'un rebuild complet reste plus simple et plus sûr qu'un patch incrémental.
 */
export async function reindexAll(): Promise<void> {
  const db = getDb();
  const tree = await listTree();
  const fiches = flattenFiches(tree);

  const entries = await Promise.all(
    fiches.map(async ({ path: segments }) => {
      const fiche = await readFiche(segments);
      return {
        path: segments.join("/"),
        title: fiche.title,
        content: fiche.content,
        folder: segments.slice(0, -1).join("/"),
      };
    }),
  );

  const linkIndex = buildLinkIndex(entries.map((e) => ({ path: e.path.split("/"), title: e.title })));

  const insert = db.prepare("INSERT INTO fiches_fts (path, title, content, folder) VALUES (?, ?, ?, ?)");
  const insertLink = db.prepare("INSERT INTO links (source, target) VALUES (?, ?)");
  const rebuild = db.transaction((rows: typeof entries) => {
    db.exec("DELETE FROM fiches_fts");
    db.exec("DELETE FROM links");
    for (const row of rows) {
      insert.run(row.path, row.title, row.content, row.folder);
      for (const target of extractLinkedPaths(row.content, linkIndex)) {
        const targetKey = target.join("/");
        if (targetKey !== row.path) insertLink.run(row.path, targetKey);
      }
    }
  });

  rebuild(entries);
}

interface Row {
  path: string;
  title: string;
  folder: string;
  snippet: string;
}

export function searchFiches(query: string, limit = 20): SearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const db = getDb();
  const ftsQuery = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(" ");

  let rows: Row[];
  try {
    rows = db
      .prepare(
        `SELECT path, title, folder, snippet(fiches_fts, 2, ?, ?, '…', 12) AS snippet
         FROM fiches_fts
         WHERE fiches_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(SNIPPET_MARK_START, SNIPPET_MARK_END, ftsQuery, limit) as Row[];
  } catch {
    // requête FTS5 mal formée (ex: uniquement des caractères spéciaux) -> aucun résultat plutôt qu'une 500
    return [];
  }

  return rows.map((row) => ({
    path: row.path.split("/"),
    title: row.title,
    folder: row.folder,
    snippet: row.snippet,
  }));
}

/** Chemins des fiches qui pointent vers `segments` (liens `[[…]]` ou liens Markdown /fiche/…). */
export function backlinksOf(segments: string[]): string[][] {
  const rows = getDb()
    .prepare("SELECT DISTINCT source FROM links WHERE target = ? ORDER BY source")
    .all(segments.join("/")) as { source: string }[];
  return rows.map((row) => row.source.split("/"));
}
