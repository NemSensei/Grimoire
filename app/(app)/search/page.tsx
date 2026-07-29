import type { ReactNode } from "react";
import Link from "next/link";
import { searchFiches } from "@/lib/db/search";
import { SNIPPET_MARK_START, SNIPPET_MARK_END } from "@/lib/db/search";

/**
 * Découpe le snippet FTS5 sur les marqueurs de contrôle et rend les passages surlignés comme
 * de vrais nœuds React (jamais dangerouslySetInnerHTML) — le contenu d'une fiche n'est pas
 * garanti exempt de caractères HTML, contrairement au rendu de la fiche qui passe par rehype-sanitize.
 */
function renderSnippet(snippet: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = new RegExp(`${SNIPPET_MARK_START}(.*?)${SNIPPET_MARK_END}`, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(snippet)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(snippet.slice(lastIndex, match.index));
    }
    nodes.push(
      <mark key={key++} className="bg-amber-700 text-neutral-100">
        {match[1]}
      </mark>,
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < snippet.length) {
    nodes.push(snippet.slice(lastIndex));
  }

  return nodes;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q ?? "";
  const results = query ? searchFiches(query) : [];

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Recherche{query && ` : "${query}"`}</h1>

      {!query && <p className="text-sm text-neutral-500">Entrez un terme de recherche.</p>}
      {query && results.length === 0 && <p className="text-sm text-neutral-500">Aucun résultat.</p>}

      <ul className="space-y-4">
        {results.map((result) => (
          <li key={result.path.join("/")}>
            <Link
              href={`/fiche/${result.path.map(encodeURIComponent).join("/")}`}
              className="text-neutral-100 hover:underline"
            >
              {result.title}
            </Link>
            <p className="text-xs text-neutral-500">{result.folder || "/"}</p>
            <p className="mt-1 text-sm text-neutral-400">{renderSnippet(result.snippet)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
