import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createFolder, moveEntry, deleteEntry, ConflictError } from "@/lib/content/fs";
import { InvalidPathError } from "@/lib/content/paths";
import { reindexAll } from "@/lib/db/search";

const segmentsSchema = z.array(z.string()).min(1);

function errorResponse(error: unknown): NextResponse {
  if (error instanceof InvalidPathError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOTEMPTY") {
    return NextResponse.json({ error: "Le dossier n'est pas vide" }, { status: 400 });
  }
  if (code === "ENOENT") {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  throw error;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z.object({ path: segmentsSchema }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  try {
    await createFolder(parsed.data.path);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z.object({ from: segmentsSchema, to: segmentsSchema }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  try {
    await moveEntry(parsed.data.from, parsed.data.to);
    await reindexAll();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z.object({ path: segmentsSchema }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  try {
    await deleteEntry(parsed.data.path);
    await reindexAll();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
