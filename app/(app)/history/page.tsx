import type { Metadata } from "next";
import Link from "next/link";
import { flattenFiches, listTree } from "@/lib/content/fs";
import { ficheHref } from "@/lib/content/labels";
import {
  deletedFiches,
  HistoryUnavailableError,
  recentActivity,
  type ActivityEntry,
  type DeletedFiche,
} from "@/lib/content/history";
import { formatDateTime, timeAgo } from "@/lib/format";
import { RestoreButton } from "@/components/history/RestoreButton";

export const metadata: Metadata = { title: "Activité" };

const STATUS: Record<string, { label: string; className: string }> = {
  A: { label: "Ajout", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  M: { label: "Modif.", className: "bg-accent-soft text-accent" },
  D: { label: "Suppr.", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
  R: { label: "Déplac.", className: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
};

function withAges<T extends { date: number }>(entries: T[]): (T & { age: string })[] {
  const now = Date.now();
  return entries.map((e) => ({ ...e, age: timeAgo(e.date, now) }));
}

export default async function ActivityPage() {
  const tree = await listTree();
  const titles = new Map(flattenFiches(tree).map((f) => [f.path.join("/"), f.title]));

  let activity: ActivityEntry[];
  let trash: DeletedFiche[];
  try {
    [activity, trash] = await Promise.all([recentActivity(40), deletedFiches((p) => titles.has(p))]);
  } catch (error) {
    if (error instanceof HistoryUnavailableError) {
      return <p className="mx-auto max-w-3xl text-fg-muted">Historique indisponible : {error.message}.</p>;
    }
    throw error;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight text-fg">Activité</h1>
      <p className="mt-2 text-fg-muted">
        Chaque modification est enregistrée avec son auteur. Ouvrez une fiche puis « Historique » pour comparer ou
        restaurer une version.
      </p>

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Derniers changements</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-fg-subtle">Aucun changement enregistré pour l’instant.</p>
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border">
            {withAges(activity).map(({ files, ...rest }) => ({
              ...rest,
              // Fichiers techniques (.gitkeep...) sans intérêt pour l'équipe.
              files: files.filter((f) => !f.path.split("/").pop()!.startsWith(".")),
            })).filter((entry) => entry.files.length > 0).map((entry) => (
              <li key={entry.sha} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-muted text-xs font-semibold uppercase text-fg-muted">
                  {entry.author.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium text-fg">{entry.author}</span>{" "}
                    <span className="text-fg-subtle" title={formatDateTime(entry.date)}>
                      · {entry.age}
                    </span>
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {entry.files.slice(0, 8).map((file) => {
                      const status = STATUS[file.status] ?? STATUS.M;
                      const title = titles.get(file.path);
                      const segments = file.path.split("/");
                      return (
                        <li key={file.path} className="flex items-center gap-2 text-sm">
                          <span className={`rounded px-1.5 py-px text-[0.65rem] font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                          {title ? (
                            <Link href={ficheHref(segments)} className="truncate text-fg-muted hover:text-accent">
                              {title}
                            </Link>
                          ) : (
                            <span className="truncate text-fg-subtle">{file.path}</span>
                          )}
                        </li>
                      );
                    })}
                    {entry.files.length > 8 && (
                      <li className="text-xs text-fg-subtle">+ {entry.files.length - 8} autres fichiers</li>
                    )}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-12">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Corbeille</h2>
        {trash.length === 0 ? (
          <p className="text-sm text-fg-subtle">Aucune fiche supprimée.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {withAges(trash).map((fiche) => (
              <li key={fiche.path} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm text-fg">{fiche.path}</p>
                  <p className="text-xs text-fg-subtle">
                    Supprimée par {fiche.author} · {fiche.age}
                  </p>
                </div>
                <RestoreButton
                  action="undelete"
                  path={fiche.path.split("/")}
                  sha={fiche.sha}
                  label="Restaurer"
                  confirmMessage={`Restaurer ${fiche.path} ?`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
