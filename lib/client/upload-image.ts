export interface UploadedImage {
  path: string[];
  url: string;
}

export async function uploadImage(folder: string[], file: File): Promise<UploadedImage> {
  const body = new FormData();
  body.set("folder", JSON.stringify(folder));
  body.set("file", file);

  const res = await fetch("/api/assets", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "Erreur lors de l'envoi de l'image");
  }
  return data as UploadedImage;
}
