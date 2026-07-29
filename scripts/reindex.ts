import { reindexAll } from "../lib/db/search";

async function main() {
  await reindexAll();
  console.log("Réindexation terminée.");
}

main();
