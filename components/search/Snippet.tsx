import type { ReactNode } from "react";
import { SNIPPET_MARK_START, SNIPPET_MARK_END } from "@/lib/search-marks";

/**
 * Découpe le snippet FTS5 sur les marqueurs de contrôle et rend les passages surlignés comme
 * de vrais nœuds React (jamais dangerouslySetInnerHTML) — le contenu d'une fiche n'est pas
 * garanti exempt de caractères HTML, contrairement au rendu de la fiche qui passe par rehype-sanitize.
 */
export function Snippet({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const regex = new RegExp(`${SNIPPET_MARK_START}(.*?)${SNIPPET_MARK_END}`, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(
      <mark key={key++} className="rounded-sm bg-accent-soft px-0.5 font-medium text-accent">
        {match[1]}
      </mark>,
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return <>{nodes}</>;
}
