import Link from "next/link";

const features = [
  {
    title: "Consulter",
    body: "Parcourez les fiches via l’arborescence à gauche. Rendu Markdown complet avec coloration syntaxique des blocs de code.",
  },
  {
    title: "Éditer",
    body: "Modifiez une fiche directement dans le navigateur. Les conflits d’édition concurrente sont détectés et signalés.",
  },
  {
    title: "Créer & importer",
    body: "Créez une fiche vierge, ou glissez-déposez des fichiers .md (et des dossiers entiers) pour les importer en conservant la structure.",
  },
  {
    title: "Rechercher",
    body: "Recherche full-text instantanée sur le titre et le contenu de toutes les fiches, depuis la barre en haut à droite.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b border-neutral-800 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Le Grimoire</h1>
        <p className="mt-3 text-neutral-400">
          Base de connaissances de l’équipe. Nos fiches techniques — méthodologies, cheat-sheets et
          notes d’intervention — centralisées, versionnées en Markdown et consultables par toute
          l’équipe.
        </p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="rounded-lg border border-neutral-800 p-4">
            <h2 className="font-medium text-neutral-100">{f.title}</h2>
            <p className="mt-1 text-sm text-neutral-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Pour commencer
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/new"
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
          >
            + Créer une fiche
          </Link>
          <Link
            href="/folders"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:border-neutral-500"
          >
            Gérer les dossiers
          </Link>
        </div>
        <p className="mt-6 text-sm text-neutral-500">
          Sélectionnez une fiche dans l’arborescence à gauche pour la consulter.
        </p>
      </section>
    </div>
  );
}
