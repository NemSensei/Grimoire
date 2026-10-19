"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "@/lib/content/markdown";
import { ArrowUpIcon, ListIcon } from "@/components/icons";

/** Sommaire « Sur cette page », avec mise en évidence de la section en cours de lecture. */
export function Toc({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const headings = entries
      .map((e) => document.getElementById(e.id))
      .filter((h): h is HTMLElement => h !== null);
    if (headings.length === 0) return;

    // Section active = dernier titre passé au-dessus du premier quart de l'écran.
    const observer = new IntersectionObserver(
      () => {
        const threshold = window.innerHeight * 0.25;
        let current = headings[0].id;
        for (const h of headings) {
          if (h.getBoundingClientRect().top <= threshold) current = h.id;
          else break;
        }
        setActiveId(current);
      },
      { rootMargin: "0px 0px -70% 0px", threshold: [0, 1] },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="Sur cette page" className="text-sm">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        <ListIcon width={14} height={14} />
        Sur cette page
      </p>
      <ul className="space-y-0.5 border-l border-border">
        {entries.map((entry) => {
          const active = entry.id === activeId;
          return (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                className={`-ml-px block border-l py-1 leading-snug transition-colors ${
                  entry.depth === 3 ? "pl-6" : "pl-3"
                } ${
                  active
                    ? "border-accent font-medium text-accent"
                    : "border-transparent text-fg-subtle hover:border-fg-subtle hover:text-fg"
                }`}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
      <a
        href="#"
        className="mt-4 flex items-center gap-1.5 text-xs text-fg-subtle transition-colors hover:text-fg"
      >
        <ArrowUpIcon width={13} height={13} />
        Haut de page
      </a>
    </nav>
  );
}
