"use client";

import { useEffect, useEffectEvent, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { EditorView } from "@codemirror/view";
import { uploadImage } from "@/lib/client/upload-image";
import { folderLabel, ficheHref as ficheHrefOf } from "@/lib/content/labels";
import { MarkdownView } from "@/components/viewer/MarkdownView";
import { ChevronLeftIcon, ImageIcon, LinkIcon } from "@/components/icons";
import { CodeEditor } from "./CodeEditor";
import { insertBlock, insertText, insertWikiLink, setHeading, toggleLinePrefix, toggleWrap, type LinkSuggestion } from "./codemirror";

type Mode = "edit" | "split" | "preview";

interface Props {
  segments: string[];
  initialContent: string;
  initialMtimeMs: number;
  suggestions: LinkSuggestion[];
}

const MODES: { id: Mode; label: string }[] = [
  { id: "edit", label: "Édition" },
  { id: "split", label: "Côte à côte" },
  { id: "preview", label: "Aperçu" },
];

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function MarkdownEditor({ segments, initialContent, initialMtimeMs, suggestions }: Props) {
  const router = useRouter();
  const viewRef = useRef<EditorView | null>(null);
  const [value, setValue] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [mtimeMs, setMtimeMs] = useState(initialMtimeMs);
  const [mode, setMode] = useState<Mode>("edit");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lockHeldBy, setLockHeldBy] = useState<string | null>(null);

  const folder = segments.slice(0, -1);
  const ficheHref = ficheHrefOf(segments);
  const apiPath = `/api/fiches/${segments.map(encodeURIComponent).join("/")}`;
  const lockApiPath = `/api/locks/${segments.map(encodeURIComponent).join("/")}`;
  const dirty = value !== savedContent;

  // Verrou d'édition informatif (cf. lib/content/edit-locks.ts)
  useEffect(() => {
    let cancelled = false;

    async function acquire() {
      const res = await fetch(lockApiPath, { method: "POST" });
      if (cancelled) return;
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setLockHeldBy(typeof data.heldBy === "string" ? data.heldBy : null);
      } else {
        setLockHeldBy(null);
      }
    }

    function release() {
      fetch(lockApiPath, { method: "DELETE", keepalive: true }).catch(() => {});
    }

    void acquire();
    const heartbeat = setInterval(() => void acquire(), 30_000);
    window.addEventListener("beforeunload", release);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", release);
      release();
    };
  }, [lockApiPath]);

  // Aperçu rendu par le serveur (même moteur que la fiche publiée), après une courte pause de frappe.
  useEffect(() => {
    if (mode === "edit") return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: value }),
          signal: controller.signal,
        });
        if (res.ok) setPreviewHtml(((await res.json()) as { html: string }).html);
      } catch {
        // requête annulée par une frappe plus récente
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, mode]);

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    setConflict(false);
    try {
      const res = await fetch(apiPath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value, expectedMtimeMs: mtimeMs }),
      });
      if (res.status === 409) {
        setConflict(true);
        return false;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la sauvegarde");
        return false;
      }
      setMtimeMs(data.mtimeMs);
      setSavedContent(value);
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndClose() {
    if (await save()) {
      router.push(ficheHref);
      router.refresh();
    }
  }

  // Ctrl/⌘ S : enregistre sans quitter l'éditeur.
  const onKeyDown = useEffectEvent(async (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (saving) return;
      if (await save()) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      }
    }
  });
  const onBeforeUnload = useEffectEvent((event: BeforeUnloadEvent) => {
    if (dirty) event.preventDefault();
  });

  useEffect(() => {
    const keyListener = (event: KeyboardEvent) => void onKeyDown(event);
    const unloadListener = (event: BeforeUnloadEvent) => onBeforeUnload(event);
    window.addEventListener("keydown", keyListener);
    window.addEventListener("beforeunload", unloadListener);
    return () => {
      window.removeEventListener("keydown", keyListener);
      window.removeEventListener("beforeunload", unloadListener);
    };
  }, []);

  async function insertImages(files: File[], position?: number) {
    setError(null);
    setUploadingImage(true);
    try {
      for (const file of files) {
        const { url } = await uploadImage(folder, file);
        const view = viewRef.current;
        if (view) insertText(view, `![](${url})\n`, position);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi de l'image");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleImageButton(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) void insertImages(files);
  }

  /** Exécute une commande de mise en forme sur l'éditeur (bouton de la barre d'outils). */
  function run(command: (view: EditorView) => unknown) {
    if (viewRef.current) command(viewRef.current);
  }

  const words = countWords(value);

  return (
    <div className="-mx-5 -my-8 flex min-h-[calc(100vh-3.5rem)] flex-col sm:-mx-8 lg:-mx-12">
      {/* En-tête collant : navigation, mode d'affichage, enregistrement */}
      <div className="sticky top-14 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <a
              href={ficheHref}
              onClick={(e) => {
                if (dirty && !window.confirm("Abandonner les modifications non enregistrées ?")) e.preventDefault();
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
            >
              <ChevronLeftIcon width={15} height={15} />
              Fermer
            </a>
            <span className="truncate text-sm text-fg-subtle">
              {[...folder.map(folderLabel), segments[segments.length - 1]].join(" › ")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-bg-muted p-0.5 text-sm" role="tablist" aria-label="Mode d'affichage">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-md px-3 py-1 transition-colors ${
                    mode === m.id ? "bg-bg font-medium text-fg shadow-sm" : "text-fg-muted hover:text-fg"
                  } ${m.id === "split" ? "hidden md:block" : ""}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => void saveAndClose()}
              disabled={saving}
              title="Enregistrer et revenir à la fiche (Ctrl+S enregistre sans quitter)"
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Terminer"}
            </button>
          </div>
        </div>

        {mode !== "preview" && (
          <Toolbar>
            <ToolButton label="Titre 1 (Ctrl+1)" onClick={() => run((v) => setHeading(v, 1))}>H1</ToolButton>
            <ToolButton label="Titre 2 (Ctrl+2)" onClick={() => run((v) => setHeading(v, 2))}>H2</ToolButton>
            <ToolButton label="Titre 3 (Ctrl+3)" onClick={() => run((v) => setHeading(v, 3))}>H3</ToolButton>
            <Separator />
            <ToolButton label="Gras (Ctrl+B)" onClick={() => run((v) => toggleWrap(v, "**"))}>
              <b>B</b>
            </ToolButton>
            <ToolButton label="Italique (Ctrl+I)" onClick={() => run((v) => toggleWrap(v, "*"))}>
              <i className="font-serif">I</i>
            </ToolButton>
            <ToolButton label="Barré (Ctrl+Maj+X)" onClick={() => run((v) => toggleWrap(v, "~~"))}>
              <s>S</s>
            </ToolButton>
            <ToolButton label="Code en ligne (Ctrl+`)" onClick={() => run((v) => toggleWrap(v, "`", "code"))}>
              <span className="font-mono text-xs">{"</>"}</span>
            </ToolButton>
            <Separator />
            <ToolButton label="Lien vers une autre fiche — tapez [[" onClick={() => run(insertWikiLink)}>
              <span className="font-mono text-xs">[[ ]]</span>
            </ToolButton>
            <ToolButton label="Lien web" onClick={() => run((v) => insertBlockInline(v, "[texte](https://)"))}>
              <LinkIcon width={15} height={15} />
            </ToolButton>
            <Separator />
            <ToolButton label="Liste à puces" onClick={() => run((v) => toggleLinePrefix(v, "- ", /^\s*(?:[-*+]|\d+\.)\s+(?:\[[ x]\]\s+)?/))}>
              •
            </ToolButton>
            <ToolButton label="Liste numérotée" onClick={() => run((v) => toggleLinePrefix(v, "1. ", /^\s*(?:[-*+]|\d+\.)\s+(?:\[[ x]\]\s+)?/))}>
              <span className="text-xs">1.</span>
            </ToolButton>
            <ToolButton label="Liste de tâches" onClick={() => run((v) => toggleLinePrefix(v, "- [ ] ", /^\s*(?:[-*+]|\d+\.)\s+(?:\[[ x]\]\s+)?/))}>
              ☑
            </ToolButton>
            <ToolButton label="Citation" onClick={() => run((v) => toggleLinePrefix(v, "> ", /^>\s?/))}>
              ❝
            </ToolButton>
            <Separator />
            <ToolButton label="Bloc de code" onClick={() => run((v) => insertBlock(v, "```bash\n\n```\n", 8))}>
              <span className="font-mono text-xs">{"{ }"}</span>
            </ToolButton>
            <ToolButton
              label="Tableau"
              onClick={() => run((v) => insertBlock(v, "| Colonne | Colonne |\n| --- | --- |\n| | |\n", 2))}
            >
              ▦
            </ToolButton>
            <CalloutMenu onPick={(kind) => run((v) => insertBlock(v, `> [!${kind}]\n> `))} />
            <label
              title="Insérer une image (ou collez / glissez-la dans l'éditeur)"
              className="flex h-8 cursor-pointer items-center rounded-md px-2 text-sm text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
            >
              {uploadingImage ? "Envoi…" : <ImageIcon width={15} height={15} />}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={handleImageButton}
                disabled={uploadingImage}
              />
            </label>
          </Toolbar>
        )}
      </div>

      {(lockHeldBy || conflict || error) && (
        <div className="space-y-2 px-4 pt-4 lg:px-6">
          {lockHeldBy && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              ⚠️ Cette fiche est en cours d&apos;édition par <strong>{lockHeldBy}</strong>. Vous pouvez continuer, mais
              vos modifications risquent d&apos;entrer en conflit à l&apos;enregistrement.
            </p>
          )}
          {conflict && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              Cette fiche a été modifiée par quelqu&apos;un d&apos;autre depuis son ouverture. Copiez vos modifications,
              puis rechargez la page pour récupérer la dernière version.
            </p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}

      {/* Zone de travail */}
      <div className={`flex-1 ${mode === "split" ? "grid grid-cols-2 divide-x divide-border" : ""}`}>
        <div className={mode === "preview" ? "hidden" : "px-6 sm:px-10"}>
          <div className={mode === "edit" ? "mx-auto max-w-3xl" : ""}>
            <CodeEditor
              initialValue={initialContent}
              suggestions={suggestions}
              viewRef={viewRef}
              onChange={setValue}
              onImages={(files, position) => void insertImages(files, position)}
            />
          </div>
        </div>
        {mode !== "edit" && (
          <div className={`px-6 py-7 sm:px-10 ${mode === "preview" ? "mx-auto w-full max-w-3xl" : "bg-bg-subtle/40"}`}>
            {previewHtml === null ? (
              <p className="text-sm text-fg-subtle">Préparation de l&apos;aperçu…</p>
            ) : (
              <MarkdownView html={previewHtml} />
            )}
          </div>
        )}
      </div>

      {/* Barre d'état */}
      <div className="sticky bottom-0 z-20 flex items-center justify-between gap-4 border-t border-border bg-bg/90 px-4 py-1.5 text-xs text-fg-subtle backdrop-blur-md lg:px-6">
        <span>
          {words} mot{words > 1 ? "s" : ""} · {value.length} caractères · ~{Math.max(1, Math.round(words / 200))} min de
          lecture
        </span>
        <span className="flex items-center gap-3">
          <span className="hidden sm:inline">[[ lien interne · Ctrl+B/I mise en forme · Ctrl+F rechercher</span>
          {savedFlash ? (
            <span className="font-medium text-emerald-600 dark:text-emerald-400">✓ Enregistré</span>
          ) : dirty ? (
            <span className="font-medium text-amber-600 dark:text-amber-400">● Non enregistré — Ctrl+S</span>
          ) : (
            <span>À jour</span>
          )}
        </span>
      </div>
    </div>
  );
}

/** Insère un fragment à la position du curseur (lien web : on garde le flux du paragraphe). */
function insertBlockInline(view: EditorView, text: string) {
  insertText(view, text);
  view.focus();
}

function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="thin-scroll flex items-center gap-0.5 overflow-x-auto border-t border-border px-3 py-1 lg:px-5">
      {children}
    </div>
  );
}

function Separator() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // mousedown.preventDefault : garde le focus (et la sélection) dans l'éditeur.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-2 text-sm font-medium text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
    >
      {children}
    </button>
  );
}

const CALLOUTS = [
  { kind: "NOTE", label: "Note", color: "bg-[var(--accent)]" },
  { kind: "TIP", label: "Astuce", color: "bg-emerald-500" },
  { kind: "IMPORTANT", label: "Important", color: "bg-violet-500" },
  { kind: "WARNING", label: "Attention", color: "bg-amber-500" },
  { kind: "CAUTION", label: "Danger", color: "bg-red-500" },
];

function CalloutMenu({ onPick }: { onPick: (kind: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <ToolButton label="Encadré (callout)" onClick={() => setOpen((o) => !o)}>
        <span className="text-xs">ⓘ ▾</span>
      </ToolButton>
      {open && (
        <div className="absolute left-0 top-9 z-40 w-40 rounded-lg border border-border bg-bg p-1 shadow-lg">
          {CALLOUTS.map((c) => (
            <button
              key={c.kind}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                onPick(c.kind);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${c.color}`} />
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
