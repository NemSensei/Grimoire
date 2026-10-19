// Squelette affiché instantanément pendant le rendu serveur d'une page (navigation perçue comme immédiate).
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse" aria-busy="true" aria-label="Chargement">
      <div className="mb-8 h-4 w-40 rounded bg-bg-muted" />
      <div className="mb-6 h-9 w-2/3 rounded-lg bg-bg-muted" />
      <div className="space-y-3">
        <div className="h-4 rounded bg-bg-muted" />
        <div className="h-4 w-11/12 rounded bg-bg-muted" />
        <div className="h-4 w-4/5 rounded bg-bg-muted" />
      </div>
      <div className="mt-8 h-32 rounded-xl bg-bg-muted" />
    </div>
  );
}
