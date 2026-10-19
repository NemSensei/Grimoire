import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentLinkIndex } from "@/lib/content/fs";
import { renderFiche } from "@/lib/content/markdown";
import { InvalidPathError, resolveSafeFichePath } from "@/lib/content/paths";
import { ficheHref, ficheTitle } from "@/lib/content/labels";
import { fileAt, fileHistory, HistoryUnavailableError, revisionDiff, type FileRevision } from "@/lib/content/history";
import { formatDateTime, timeAgo } from "@/lib/format";
import { DiffView } from "@/components/history/DiffView";
import { RestoreButton } from "@/components/history/RestoreButton";
import { MarkdownView } from "@/components/viewer/MarkdownView";
import { ChevronLeftIcon } from "@/components/icons";

type Props = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ rev?: string; view?: string }>;
};

export const metadata: Metadata = { title: "Historique" };

function withAges(revisions: FileRevision[]) {
  const now = Date.now();
  return revisions.map((r) => ({ ...r, age: timeAgo(r.date, now) }));
}

export default async function FicheHistoryPage({ params, searchParams }: Props) {
  const { path: segments } = await params;
  const { rev, view } = await searchParams;

  try {
    resolveSafeFichePath(segments);
  } catch (error) {
    if (error instanceof InvalidPathError) notFound();
    throw error;
  }

  let revisions: FileRevision[];
  try {
    revisions = await fileHistory(segments);
  } catch (error) {
    if (error instanceof HistoryUnavailableError) {
      return <p className="mx-auto max-w-3xl text-fg-muted">Historique indisponible : {error.message}.</p>;
    }
    throw error;
  }
  if (revisions.length === 0) notFound();

  const index = Math.max(0, rev ? revisions.findIndex((r) => r.sha.startsWith(rev)) : 0);
  const selected = revisions[index];
  const previous = revisions[index + 1];
  const showContent = view === "content";
  const base = `/history/${segments.map(encodeURIComponent).join("/")}`;

  const [content, patch] = await Promise.all([
    fileAt(selected.sha, selected.path).catch(() => ""),
    showContent ? Promise.resolve("") : revisionDiff(selected.sha, [selected.path, previous?.path ?? selected.path]),
  ]);
  const title = ficheTitle(content, segments[segments.length - 1]);
  const rendered = showContent ? await renderFiche(content, { links: await currentLinkIndex() }) : null;
  const items = withAges(revisions);

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={ficheHref(segments)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-fg-subtle transition-colors hover:text-fg"
      >
        <ChevronLeftIcon width={14} height={14} />
        Retour à la fiche
      </Link>
      <h1 className="text-3xl font-bold tracking-tight text-fg">Historique</h1>
      <p className="mt-1 text-fg-muted">
        {title} · {revisions.length} version{revisions.length > 1 ? "s" : ""}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_1fr]">
        {/* Frise des versions */}
        <ol className="relative space-y-1 lg:sticky lg:top-20 lg:self-start">
          {items.map((r, i) => {
            const active = i === index;
            return (
              <li key={r.sha}>
                <Link
                  href={`${base}?rev=${r.sha.slice(0, 12)}${showContent ? "&view=content" : ""}`}
                  className={`flex gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    active ? "bg-accent-soft" : "hover:bg-bg-subtle"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold uppercase ${
                      active ? "bg-accent text-accent-fg" : "bg-bg-muted text-fg-muted"
                    }`}
                  >
                    {r.author.slice(0, 2)}
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-medium ${active ? "text-accent" : "text-fg"}`}>
                      {r.author}
                      {i === 0 && <span className="ml-2 text-xs font-normal text-fg-subtle">actuelle</span>}
                    </span>
                    <span className="block truncate text-xs text-fg-muted">{r.message.replace(/ de .*$/, "")}</span>
                    <span className="block text-xs text-fg-subtle" title={formatDateTime(r.date)}>
                      {r.age}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        {/* Détail de la version sélectionnée */}
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-fg">{selected.message}</p>
              <p className="text-sm text-fg-subtle">
                {selected.author} · {formatDateTime(selected.date)} ·{" "}
                <code className="font-mono text-xs">{selected.sha.slice(0, 7)}</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-bg-muted p-0.5 text-sm">
                <Link
                  href={`${base}?rev=${selected.sha.slice(0, 12)}`}
                  className={`rounded-md px-3 py-1 ${!showContent ? "bg-bg font-medium text-fg shadow-sm" : "text-fg-muted"}`}
                >
                  Modifications
                </Link>
                <Link
                  href={`${base}?rev=${selected.sha.slice(0, 12)}&view=content`}
                  className={`rounded-md px-3 py-1 ${showContent ? "bg-bg font-medium text-fg shadow-sm" : "text-fg-muted"}`}
                >
                  Contenu
                </Link>
              </div>
              {index > 0 && (
                <RestoreButton
                  action="restore"
                  path={segments}
                  sha={selected.sha}
                  label="Restaurer cette version"
                  confirmMessage={`Remettre la fiche dans l'état du ${formatDateTime(selected.date)} ? La version actuelle restera dans l'historique.`}
                />
              )}
            </div>
          </div>

          {rendered ? (
            <div className="rounded-xl border border-border p-6 sm:p-8">
              <MarkdownView html={rendered.html} />
            </div>
          ) : (
            <DiffView patch={patch} />
          )}
        </section>
      </div>
    </div>
  );
}
