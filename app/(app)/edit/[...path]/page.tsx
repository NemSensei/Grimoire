import { notFound } from "next/navigation";
import { flattenFiches, listTree, readFiche } from "@/lib/content/fs";
import { InvalidPathError } from "@/lib/content/paths";
import { folderLabel } from "@/lib/content/labels";
import { linkTargetFor } from "@/lib/content/links";
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

  // Fiches proposées par l'autocomplétion des liens [[…]]
  const all = flattenFiches(await listTree());
  const suggestions = all
    .filter((f) => f.path.join("/") !== segments.join("/"))
    .map((f) => ({
      title: f.title,
      target: linkTargetFor(f, all),
      folder: f.path.slice(0, -1).map(folderLabel).join(" › "),
    }));

  return (
    <MarkdownEditor
      segments={segments}
      initialContent={fiche.content}
      initialMtimeMs={fiche.mtimeMs}
      suggestions={suggestions}
    />
  );
}
