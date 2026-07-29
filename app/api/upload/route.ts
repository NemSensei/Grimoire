import { NextRequest, NextResponse } from "next/server";
import { saveUploadedFiche } from "@/lib/content/fs";
import { InvalidPathError } from "@/lib/content/paths";
import { reindexAll } from "@/lib/db/search";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const folderRaw = form.get("folder");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".md")) {
    return NextResponse.json({ error: "Seuls les fichiers .md sont acceptés" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (2 Mo max)" }, { status: 400 });
  }

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

  const content = await file.text();

  try {
    const path = await saveUploadedFiche(folder, file.name, content);
    await reindexAll();
    return NextResponse.json({ path });
  } catch (error) {
    if (error instanceof InvalidPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
