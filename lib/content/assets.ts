import fs from "node:fs/promises";
import crypto from "node:crypto";
import { CONTENT_ROOT, resolveSafeAssetPath, resolveSafeFolderPath } from "./paths";

export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

/**
 * Vérifie la signature binaire (magic bytes) plutôt que de faire confiance au nom de fichier ou
 * au Content-Type déclaré par le navigateur, trivialement falsifiables l'un comme l'autre.
 */
export function detectImageExtension(buffer: Buffer): string | null {
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return "gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

/** Écrit une image dans folderSegments sous un nom généré (jamais dérivé du nom original). */
export async function saveImage(folderSegments: string[], buffer: Buffer, extension: string): Promise<string[]> {
  const folderAbs = folderSegments.length > 0 ? resolveSafeFolderPath(folderSegments) : CONTENT_ROOT;
  await fs.mkdir(folderAbs, { recursive: true });

  const filename = `img-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${extension}`;
  const segments = [...folderSegments, filename];
  await fs.writeFile(resolveSafeAssetPath(segments), buffer);
  return segments;
}

export async function readAsset(segments: string[]): Promise<Buffer> {
  return fs.readFile(resolveSafeAssetPath(segments));
}

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export function mimeTypeForExtension(extension: string): string {
  return MIME_TYPES[extension.toLowerCase()] ?? "application/octet-stream";
}
