import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentLinkIndex } from "@/lib/content/fs";
import { renderFiche } from "@/lib/content/markdown";

const bodySchema = z.object({ content: z.string().max(2 * 1024 * 1024) });

/** Aperçu de l'éditeur : même moteur de rendu que les fiches publiées (callouts, liens [[…]]...). */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const { html } = await renderFiche(parsed.data.content, { links: await currentLinkIndex() });
  return NextResponse.json({ html });
}
