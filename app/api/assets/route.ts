import { NextRequest, NextResponse } from "next/server";
import { detectImageExtension, saveImage, MAX_IMAGE_SIZE_BYTES } from "@/lib/content/assets";
import { InvalidPathError } from "@/lib/content/paths";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const folderRaw = form.get("folder");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: "Image trop volumineuse (8 Mo max)" }, { status: 400 });
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = detectImageExtension(buffer);
  if (!extension) {
    return NextResponse.json({ error: "Format d'image non reconnu (PNG, JPEG, GIF, WebP uniquement)" }, { status: 400 });
  }

  try {
    const path = await saveImage(folder, buffer, extension);
    const url = `/api/assets/${path.map(encodeURIComponent).join("/")}`;
    return NextResponse.json({ path, url });
  } catch (error) {
    if (error instanceof InvalidPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
