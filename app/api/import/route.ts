import { NextRequest, NextResponse } from "next/server";
import { importFiches, type ImportEntry } from "@/lib/content/fs";
import { InvalidPathError } from "@/lib/content/paths";
import { afterMutation } from "@/lib/content/after-mutation";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 200;

interface SkippedEntry {
  relativePath: string;
  reason: string;
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const folderRaw = form.get("folder");
  const files = form.getAll("files");
  const relativePaths = form.getAll("relativePaths");

  let folder: string[] = [];
  if (typeof folderRaw === "string" && folderRaw.length > 0) {
    try {
      const parsedFolder: unknown = JSON.parse(folderRaw);
      if (!Array.isArray(parsedFolder) || !parsedFolder.every((s) => typeof s === "string")) {
        throw new Error("invalid");
      }
      folder = parsedFolder;
    } catch {
      return NextResponse.json({ error: "Dossier invalide" }, { status: 400 });
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  }
  if (files.length !== relativePaths.length) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Trop de fichiers (${MAX_FILES} max)` }, { status: 400 });
  }

  const entries: ImportEntry[] = [];
  const skipped: SkippedEntry[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = relativePaths[i];
    if (!(file instanceof File) || typeof relativePath !== "string" || relativePath.length === 0) {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }
    if (!relativePath.toLowerCase().endsWith(".md")) {
      skipped.push({ relativePath, reason: "extension non supportée" });
      continue;
    }
    if (file.size > MAX_SIZE_BYTES) {
      skipped.push({ relativePath, reason: "fichier trop volumineux (2 Mo max)" });
      continue;
    }
    entries.push({
      relativePath: relativePath.split("/").filter(Boolean),
      content: await file.text(),
    });
  }

  try {
    const { imported } = await importFiches(folder, entries);
    await afterMutation(`Import de ${imported.length} fiche(s)`);
    return NextResponse.json({ imported, skipped });
  } catch (error) {
    if (error instanceof InvalidPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
