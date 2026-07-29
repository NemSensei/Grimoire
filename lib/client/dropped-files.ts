export interface DroppedFile {
  /** Chemin relatif à la racine du drop, filename inclus (ex: "sous-dossier/fiche.md"). */
  relativePath: string;
  file: File;
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

function readFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkEntry(entry: FileSystemEntry, prefix: string, out: DroppedFile[]): Promise<void> {
  if (entry.name.startsWith(".")) return;

  if (entry.isFile) {
    const file = await readFile(entry as FileSystemFileEntry);
    out.push({ relativePath: prefix ? `${prefix}/${entry.name}` : entry.name, file });
    return;
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    // readEntries() ne renvoie qu'un lot limité (~100) par appel : il faut boucler jusqu'à un tableau vide.
    let batch: FileSystemEntry[];
    do {
      batch = await readEntries(reader);
      for (const child of batch) {
        await walkEntry(child, childPrefix, out);
      }
    } while (batch.length > 0);
  }
}

/**
 * Extrait récursivement tous les fichiers d'un drop (fichiers seuls et/ou dossiers imbriqués),
 * avec leur chemin relatif. Repli sur dataTransfer.files (à plat, sans structure de dossier) si
 * le navigateur ne supporte pas webkitGetAsEntry.
 */
export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<DroppedFile[]> {
  const items = Array.from(dataTransfer.items);
  const supportsEntries = items.length > 0 && typeof items[0].webkitGetAsEntry === "function";

  if (!supportsEntries) {
    return Array.from(dataTransfer.files).map((file) => ({ relativePath: file.name, file }));
  }

  const out: DroppedFile[] = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    if (entry) await walkEntry(entry, "", out);
  }
  return out;
}
