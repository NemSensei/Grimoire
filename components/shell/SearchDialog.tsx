"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/db/search";
import { folderLabel, ficheHref } from "@/lib/content/labels";
import { Snippet } from "@/components/search/Snippet";
import { CornerDownLeftIcon, FileIcon, SearchIcon } from "@/components/icons";

const DEBOUNCE_MS = 120;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Palette de recherche instantanée (Ctrl/⌘ K ou « / »), branchée sur /api/search. */
export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function close() {
    setOpen(false);
  }

  function search(q: string) {
    setQuery(q);
    setActive(0);
    if (timer.current) clearTimeout(timer.current);
    controller.current?.abort();

    if (q.trim().length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      controller.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
      } catch {
        if (ctrl.signal.aborted) return;
        setResults([]);
      }
      setLoading(false);
    }, DEBOUNCE_MS);
  }

  function go(result: SearchResult) {
    close();
    router.push(ficheHref(result.path));
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      const next = (active + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) go(results[active]);
      else if (query.trim()) {
        close();
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-1.5 text-sm text-fg-subtle transition-colors hover:border-fg-subtle/50 hover:text-fg-muted"
      >
        <SearchIcon width={15} height={15} />
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="hidden rounded border border-border bg-bg px-1.5 font-sans text-[0.7rem] font-medium sm:inline">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Recherche"
            className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-bg shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <SearchIcon className="shrink-0 text-fg-subtle" />
              <input
                autoFocus
                value={query}
                onChange={(e) => search(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Rechercher dans les fiches…"
                className="h-12 flex-1 bg-transparent text-[0.95rem] text-fg outline-none placeholder:text-fg-subtle"
              />
              <kbd className="rounded border border-border px-1.5 text-[0.7rem] text-fg-subtle">Échap</kbd>
            </div>

            <div className="thin-scroll max-h-[60vh] overflow-y-auto">
              {query.trim() === "" ? (
                <p className="px-4 py-8 text-center text-sm text-fg-subtle">
                  Titre, contenu, commande… la recherche porte sur toutes les fiches.
                </p>
              ) : results.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-fg-subtle">
                  {loading ? "Recherche…" : `Aucun résultat pour « ${query.trim()} ».`}
                </p>
              ) : (
                <ul ref={listRef} className="p-2">
                  {results.map((r, i) => (
                    <li key={r.path.join("/")}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(r)}
                        className={`flex w-full gap-3 rounded-lg px-3 py-2.5 text-left ${
                          i === active ? "bg-accent-soft" : ""
                        }`}
                      >
                        <FileIcon className={`mt-0.5 shrink-0 ${i === active ? "text-accent" : "text-fg-subtle"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className={`truncate font-medium ${i === active ? "text-accent" : "text-fg"}`}>
                              {r.title}
                            </span>
                            {r.folder && (
                              <span className="truncate text-xs text-fg-subtle">
                                {r.folder.split("/").map(folderLabel).join(" › ")}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-fg-muted">
                            <Snippet text={r.snippet} />
                          </span>
                        </span>
                        {i === active && <CornerDownLeftIcon className="mt-0.5 shrink-0 text-accent" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-border bg-bg-subtle px-4 py-2 text-[0.7rem] text-fg-subtle">
              <span>↑↓ naviguer</span>
              <span>↵ ouvrir</span>
              <span>Échap fermer</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
