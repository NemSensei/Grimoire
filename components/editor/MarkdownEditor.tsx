"use client";

import dynamic from "next/dynamic";
import { useEffect, useEffectEvent, useState, type ChangeEvent, type ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadImage } from "@/lib/client/upload-image";
import { useIsDark } from "@/lib/client/theme";
import { folderLabel } from "@/lib/content/labels";
import { ChevronLeftIcon } from "@/components/icons";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface Props {
  segments: string[];
  initialContent: string;
  initialMtimeMs: number;
}

export function MarkdownEditor({ segments, initialContent, initialMtimeMs }: Props) {
  const router = useRouter();
  const dark = useIsDark();
  const [value, setValue] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lockHeldBy, setLockHeldBy] = useState<string | null>(null);

  const folder = segments.slice(0, -1);
  const ficheHref = `/fiche/${segments.map(encodeURIComponent).join("/")}`;
  const apiPath = `/api/fiches/${segments.map(encodeURIComponent).join("/")}`;
  const lockApiPath = `/api/locks/${segments.map(encodeURIComponent).join("/")}`;

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

  /**
   * Insère `![](url)` à la position du curseur si on a une référence au textarea (cas collage),
   * sinon en fin de contenu (cas bouton "+ Image", pas de position de curseur disponible).
   */
  async function insertImage(file: File, target?: HTMLTextAreaElement) {
    setImageError(null);
    setUploadingImage(true);
    try {
      const { url } = await uploadImage(folder, file);
      const markdown = `![](${url})`;

      if (target) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        setValue((prev) => `${prev.slice(0, start)}${markdown}${prev.slice(end)}`);
        requestAnimationFrame(() => {
          target.focus();
          const pos = start + markdown.length;
          target.selectionStart = pos;
          target.selectionEnd = pos;
        });
      } else {
        setValue((prev) => (prev.length > 0 ? `${prev}\n\n${markdown}\n` : `${markdown}\n`));
      }
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Erreur lors de l'envoi de l'image");
    } finally {
      setUploadingImage(false);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const item = Array.from(event.clipboardData?.items ?? []).find((it) => it.type.startsWith("image/"));
    if (!item) return; // pas une image : laisse le collage texte normal se produire

    event.preventDefault();
    const file = item.getAsFile();
    if (!file) return;

    // Capturé avant l'await : React vide event.currentTarget après le handler synchrone,
    // mais cette référence au vrai nœud DOM reste valable indépendamment de ça.
    const target = event.currentTarget;
    void insertImage(file, target);
  }

  function handleImageButtonChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void insertImage(file);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setConflict(false);
    try {
      const res = await fetch(apiPath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value, expectedMtimeMs: initialMtimeMs }),
      });

      if (res.status === 409) {
        setConflict(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors de la sauvegarde");
        return;
      }

      router.push(ficheHref);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // Ctrl/⌘ S : sauvegarde sans quitter le clavier.
  const onSaveShortcut = useEffectEvent((event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!saving) void handleSave();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onSaveShortcut(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const dirty = value !== initialContent;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4" data-color-mode={dark ? "dark" : "light"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <a
            href={ficheHref}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
          >
            <ChevronLeftIcon width={15} height={15} />
            Annuler
          </a>
          <span className="truncate text-sm text-fg-subtle">
            {[...folder.map(folderLabel), segments[segments.length - 1]].join(" › ")}
            {dirty && <span className="ml-2 text-amber-600 dark:text-amber-400">● non sauvegardé</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg">
            {uploadingImage ? "Envoi…" : "+ Image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={handleImageButtonChange}
              disabled={uploadingImage}
            />
          </label>
          <button
            onClick={handleSave}
            disabled={saving}
            title="Ctrl+S"
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {lockHeldBy && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ Cette fiche est en cours d&apos;édition par <strong>{lockHeldBy}</strong>. Vous pouvez continuer, mais
          vos modifications risquent d&apos;entrer en conflit à la sauvegarde.
        </p>
      )}
      {conflict && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          Cette fiche a été modifiée par quelqu&apos;un d&apos;autre depuis son ouverture. Rechargez la page pour
          récupérer la dernière version avant de continuer.
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {imageError && <p className="text-sm text-red-600 dark:text-red-400">{imageError}</p>}

      <MDEditor
        value={value}
        onChange={(v) => setValue(v ?? "")}
        height="calc(100vh - 12rem)"
        visibleDragbar={false}
        textareaProps={{ onPaste: handlePaste }}
      />
    </div>
  );
}
