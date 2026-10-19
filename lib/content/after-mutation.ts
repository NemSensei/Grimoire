import { requireUser } from "@/lib/auth/session";
import { reindexAll } from "@/lib/db/search";
import { commitAll } from "./history";

/**
 * À appeler par chaque route après une écriture dans content/ : reconstruit l'index de recherche
 * et des liens, puis enregistre la modification dans l'historique au nom de l'utilisateur.
 */
export async function afterMutation(message: string): Promise<void> {
  const user = await requireUser().catch(() => null);
  await Promise.all([reindexAll(), commitAll(user?.username ?? "inconnu", message)]);
}
