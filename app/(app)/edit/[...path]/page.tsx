import { notFound } from "next/navigation";
import { readFiche } from "@/lib/content/fs";
import { InvalidPathError } from "@/lib/content/paths";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";

export default async function EditFichePage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  let fiche;
  try {
    fiche = await readFiche(segments);
  } catch (error) {
    if (error instanceof InvalidPathError) notFound();
    if ((error as NodeJS.ErrnoException).code === "ENOENT") notFound();
    throw error;
  }

  return <MarkdownEditor segments={segments} initialContent={fiche.content} initialMtimeMs={fiche.mtimeMs} />;
}
