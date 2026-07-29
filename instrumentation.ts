export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reindexAll } = await import("./lib/db/search");
    await reindexAll();
  }
}
