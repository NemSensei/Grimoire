"use client";

import type { MouseEvent } from "react";

/** Clic délégué sur les boutons « Copier » insérés côté serveur par rehypeDocEnhance. */
function handleClick(event: MouseEvent<HTMLElement>) {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".code-copy");
  if (!button) return;
  const code = button.closest(".code-block")?.querySelector("pre")?.textContent ?? "";

  void navigator.clipboard?.writeText(code).then(() => {
    button.textContent = "Copié ✓";
    button.dataset.copied = "";
    setTimeout(() => {
      button.textContent = "Copier";
      delete button.dataset.copied;
    }, 1500);
  });
}

export function MarkdownView({ html }: { html: string }) {
  return (
    <article
      className="doc prose max-w-none min-w-0 break-words prose-headings:scroll-mt-20"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
