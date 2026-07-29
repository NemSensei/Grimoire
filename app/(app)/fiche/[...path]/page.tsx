import { notFound } from "next/navigation";
import Link from "next/link";
import { readFiche } from "@/lib/content/fs";
import { renderMarkdown } from "@/lib/content/markdown";
import { InvalidPathError } from "@/lib/content/paths";
import { MarkdownView } from "@/components/viewer/MarkdownView";

export default async function FichePage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  let fiche;
  try {
    fiche = await readFiche(segments);
  } catch (error) {
    if (error instanceof InvalidPathError) notFound();
    if ((error as NodeJS.ErrnoException).code === "ENOENT") notFound();
    throw error;
  }

  const html = await renderMarkdown(fiche.content);
  const editHref = `/edit/${segments.map(encodeURIComponent).join("/")}`;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Link href={editHref} className="text-sm text-neutral-400 hover:text-neutral-100">
          Modifier
        </Link>
      </div>
      <MarkdownView html={html} />
    </div>
  );
}
