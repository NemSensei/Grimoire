import Link from "next/link";
import { flattenFiches, listTree, type TreeFiche } from "@/lib/content/fs";
import { ficheHref, folderLabel } from "@/lib/content/labels";
import { timeAgo } from "@/lib/format";
import { ChevronRightIcon, FileIcon, FolderIcon, PlusIcon, SearchIcon } from "@/components/icons";

/** Fiches les plus récemment modifiées, avec leur ancienneté en toutes lettres. */
function recentFiches(all: TreeFiche[], count: number): { fiche: TreeFiche; age: string }[] {
  const now = Date.now();
  return [...all]
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, count)
    .map((fiche) => ({ fiche, age: timeAgo(fiche.mtimeMs, now) }));
}

function FicheRow({ fiche, meta }: { fiche: TreeFiche; meta?: string }) {
  const folder = fiche.path.slice(0, -1).map(folderLabel).join(" › ");
  return (
    <Link
      href={ficheHref(fiche.path)}
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-subtle"
    >
      <FileIcon className="shrink-0 text-fg-subtle group-hover:text-accent" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-fg group-hover:text-accent">{fiche.title}</span>
        {folder && <span className="block truncate text-xs text-fg-subtle">{folder}</span>}
      </span>
      {meta && <span className="shrink-0 text-xs text-fg-subtle">{meta}</span>}
    </Link>
  );
}

export default async function HomePage() {
  const tree = await listTree();
  const all = flattenFiches(tree);
  const sections = tree.filter((n) => n.type === "folder");
  const rootFiches = tree.filter((n): n is TreeFiche => n.type === "fiche");
  const recent = recentFiches(all, 6);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="pb-10 pt-4">
        <p className="mb-3 text-sm font-medium text-accent">Base de connaissances</p>
        <h1 className="text-4xl font-bold tracking-tight text-fg sm:text-5xl">Le Grimoire</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fg-muted">
          Méthodologies, cheat-sheets et notes d’intervention de l’équipe, centralisées en Markdown et
          consultables par tous.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/new"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            <PlusIcon width={15} height={15} />
            Créer une fiche
          </Link>
          <span className="flex items-center gap-2 text-fg-subtle">
            <SearchIcon width={15} height={15} />
            Appuyez sur{" "}
            <kbd className="rounded border border-border bg-bg-subtle px-1.5 py-0.5 text-xs">Ctrl K</kbd> pour
            rechercher
          </span>
        </div>
        <p className="mt-6 text-sm text-fg-subtle">
          {all.length} fiche{all.length > 1 ? "s" : ""} · {sections.length} section{sections.length > 1 ? "s" : ""}
        </p>
      </header>

      {sections.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Sections</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {sections.map((section) => {
              const fiches = flattenFiches(section.children);
              const first = fiches[0];
              const card = (
                <>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                      <FolderIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-fg">{folderLabel(section.name)}</span>
                      <span className="text-xs text-fg-subtle">
                        {fiches.length} fiche{fiches.length > 1 ? "s" : ""}
                      </span>
                    </span>
                    <ChevronRightIcon className="text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                  </div>
                  {fiches.length > 0 && (
                    <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm text-fg-muted">
                      {fiches.slice(0, 3).map((f) => (
                        <li key={f.path.join("/")} className="truncate">
                          {f.title}
                        </li>
                      ))}
                      {fiches.length > 3 && <li className="text-xs text-fg-subtle">+ {fiches.length - 3} autres</li>}
                    </ul>
                  )}
                </>
              );
              const className =
                "group block rounded-xl border border-border bg-bg p-5 transition-all hover:border-accent hover:shadow-sm";
              return first ? (
                <Link key={section.name} href={ficheHref(first.path)} className={className}>
                  {card}
                </Link>
              ) : (
                <div key={section.name} className={className}>
                  {card}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-12 md:grid-cols-2">
        {recent.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Modifiées récemment
            </h2>
            <div className="-mx-3">
              {recent.map(({ fiche, age }) => (
                <FicheRow key={fiche.path.join("/")} fiche={fiche} meta={age} />
              ))}
            </div>
          </section>
        )}

        {rootFiches.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Hors section</h2>
            <div className="-mx-3">
              {rootFiches.map((f) => (
                <FicheRow key={f.path.join("/")} fiche={f} />
              ))}
            </div>
          </section>
        )}
      </div>

      {all.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-fg-muted">
          Aucune fiche pour l’instant.{" "}
          <Link href="/new" className="font-medium text-accent">
            Créez la première
          </Link>{" "}
          ou importez un dossier de fichiers Markdown.
        </div>
      )}
    </div>
  );
}
