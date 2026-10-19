export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { commitAll } = await import("./lib/content/history");
    const { reindexAll } = await import("./lib/db/search");
    // Initialise l'historique au premier démarrage, et enregistre ce qui a changé sur le disque
    // pendant que l'application était arrêtée (édition directe des fichiers, git pull...).
    await commitAll("Grimoire", "Synchronisation des fichiers modifiés hors de l'application");
    await reindexAll();
  }
}
