import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { flattenFiches, listTree, readFiche } from "@/lib/content/fs";
import { renderFiche } from "@/lib/content/markdown";
import { InvalidPathError } from "@/lib/content/paths";
import { editHref, ficheHref, folderLabel } from "@/lib/content/labels";
import { MarkdownView } from "@/components/viewer/MarkdownView";
import { Toc } from "@/components/viewer/Toc";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, PencilIcon } from "@/components/icons";

type Params = { params: Promise<{ path: string[] }> };

// Dédoublonne la lecture entre generateMetadata et la page pour une même requête.
const loadFiche = cache(async (segments: string[]) => {
  try {
    return await readFiche(segments);
  } catch (error) {
    if (error instanceof InvalidPathError) notFound();
    if ((error as NodeJS.ErrnoException).code === "ENOENT") notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { path: segments } = await params;
  const fiche = await loadFiche(segments);
  return { title: fiche.title };
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export default async function FichePage({ params }: Params) {
  const { path: segments } = await params;
  const [fiche, tree] = await Promise.all([loadFiche(segments), listTree()]);
  const { html, toc } = await renderFiche(fiche.content, `${segments.join("/")}:${fiche.mtimeMs}`);

  const ordered = flattenFiches(tree);
  const index = ordered.findIndex((f) => f.path.join("/") === segments.join("/"));
  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;

  const folders = segments.slice(0, -1);
  const minutes = Math.max(1, Math.round(fiche.content.split(/\s+/).length / 200));

  return (
    <div className="flex gap-12">
      <div className="mx-auto min-w-0 max-w-3xl flex-1">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Fil d'Ariane" className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-fg-subtle">
            <Link href="/" className="hover:text-fg">
              Accueil
            </Link>
            {folders.map((name) => (
              <span key={name} className="flex items-center gap-1">
                <ChevronRightIcon width={13} height={13} />
                <span>{folderLabel(name)}</span>
              </span>
            ))}
          </nav>
          <Link
            href={editHref(segments)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:border-fg-subtle/50 hover:bg-bg-subtle hover:text-fg"
          >
            <PencilIcon width={14} height={14} />
            Modifier
          </Link>
        </div>

        <MarkdownView html={html} />

        <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border pt-5 text-xs text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <ClockIcon width={13} height={13} />
            Dernière modification le {dateFormat.format(fiche.mtimeMs)}
          </span>
          <span>{minutes} min de lecture</span>
        </div>

        {(prev || next) && (
          <nav aria-label="Fiches voisines" className="mt-8 grid gap-4 sm:grid-cols-2">
            {prev ? (
              <Link
                href={ficheHref(prev.path)}
                className="group flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:border-accent"
              >
                <ChevronLeftIcon className="shrink-0 text-fg-subtle group-hover:text-accent" />
                <span className="min-w-0">
                  <span className="block text-xs text-fg-subtle">Précédent</span>
                  <span className="block truncate font-medium text-fg group-hover:text-accent">{prev.title}</span>
                </span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next && (
              <Link
                href={ficheHref(next.path)}
                className="group flex items-center justify-end gap-3 rounded-xl border border-border p-4 text-right transition-colors hover:border-accent"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-fg-subtle">Suivant</span>
                  <span className="block truncate font-medium text-fg group-hover:text-accent">{next.title}</span>
                </span>
                <ChevronRightIcon className="shrink-0 text-fg-subtle group-hover:text-accent" />
              </Link>
            )}
          </nav>
        )}
      </div>

      <aside className="hidden w-56 shrink-0 xl:block">
        <div className="thin-scroll sticky top-22 max-h-[calc(100vh-7rem)] overflow-y-auto">
          <Toc entries={toc} />
        </div>
      </aside>
    </div>
  );
}
