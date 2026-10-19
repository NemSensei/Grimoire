import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ConflictError, restoreFiche } from "@/lib/content/fs";
import { InvalidPathError, resolveSafeFichePath } from "@/lib/content/paths";
import { fileAt, fileHistory, HistoryUnavailableError } from "@/lib/content/history";
import { afterMutation } from "@/lib/content/after-mutation";

const bodySchema = z.object({
  /** restore : remettre une fiche existante dans l'état d'une version ; undelete : ramener une fiche supprimée. */
  action: z.enum(["restore", "undelete"]),
  path: z.array(z.string()).min(1),
  sha: z.string().regex(/^[0-9a-f]{7,40}$/),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const { action, path: segments, sha } = parsed.data;
  const label = segments.join("/");

  try {
    resolveSafeFichePath(segments);

    if (action === "restore") {
      const revision = (await fileHistory(segments)).find((r) => r.sha.startsWith(sha));
      if (!revision) return NextResponse.json({ error: "Version introuvable" }, { status: 404 });
      await restoreFiche(segments, await fileAt(revision.sha, revision.path));
      await afterMutation(`Restauration de ${label} (version ${revision.sha.slice(0, 7)})`);
    } else {
      // La version `sha` est celle qui a supprimé la fiche : son contenu est dans le parent.
      await restoreFiche(segments, await fileAt(sha, label, true), true);
      await afterMutation(`Récupération de ${label} depuis la corbeille`);
    }
    return NextResponse.json({ path: segments });
  } catch (error) {
    if (error instanceof InvalidPathError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof ConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof HistoryUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    throw error;
  }
}
