import Link from "next/link";
import { searchFiches } from "@/lib/db/search";
import { ficheHref, folderLabel } from "@/lib/content/labels";
import { Snippet } from "@/components/search/Snippet";
import { FileIcon } from "@/components/icons";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q ?? "";
  const results = query ? searchFiches(query) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-fg">Recherche</h1>
      {query && (
        <p className="mt-2 text-fg-muted">
          {results.length} résultat{results.length > 1 ? "s" : ""} pour « {query} »
        </p>
      )}

      {!query && <p className="mt-4 text-fg-subtle">Entrez un terme de recherche (Ctrl K).</p>}

      <ul className="mt-8 space-y-3">
        {results.map((result) => (
          <li key={result.path.join("/")}>
            <Link
              href={ficheHref(result.path)}
              className="group block rounded-xl border border-border p-4 transition-colors hover:border-accent"
            >
              <span className="flex items-center gap-2">
                <FileIcon className="shrink-0 text-fg-subtle group-hover:text-accent" />
                <span className="font-medium text-fg group-hover:text-accent">{result.title}</span>
              </span>
              <span className="mt-0.5 block pl-6 text-xs text-fg-subtle">
                {result.folder ? result.folder.split("/").map(folderLabel).join(" › ") : "Racine"}
              </span>
              <p className="mt-2 pl-6 text-sm leading-relaxed text-fg-muted">
                <Snippet text={result.snippet} />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
