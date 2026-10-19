import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readFiche, writeFiche, ConflictError } from "@/lib/content/fs";
import { InvalidPathError } from "@/lib/content/paths";
import { afterMutation } from "@/lib/content/after-mutation";

const putSchema = z.object({
  content: z.string(),
  expectedMtimeMs: z.number(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  try {
    const fiche = await readFiche(segments);
    return NextResponse.json(fiche);
  } catch (error) {
    if (error instanceof InvalidPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    throw error;
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  try {
    const result = await writeFiche(segments, parsed.data.content, parsed.data.expectedMtimeMs);
    await afterMutation(`Modification de ${segments.join("/")}`);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    throw error;
  }
}
