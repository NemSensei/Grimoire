"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImportDropzone } from "@/components/ImportDropzone";

function folderLabel(folder: string[]): string {
  return folder.length === 0 ? "/ (racine)" : folder.join("/");
}

export function NewFicheForm({ folders, initialTitle }: { folders: string[][]; initialTitle: string }) {
  const router = useRouter();
  const [folderIndex, setFolderIndex] = useState(0);
  const [title, setTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/fiches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: folders[folderIndex], title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création");
        return;
      }
      router.push(`/edit/${(data.path as string[]).map(encodeURIComponent).join("/")}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nouvelle fiche</h1>
        <p className="mt-2 text-fg-muted">Créez une fiche vierge ou importez des fichiers Markdown existants.</p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-fg-muted" htmlFor="folder">
          Dossier
        </label>
        <select
          id="folder"
          value={folderIndex}
          onChange={(e) => setFolderIndex(Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        >
          {folders.map((folder, i) => (
            <option key={folder.join("/")} value={i}>
              {folderLabel(folder)}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-border p-5">
        <h2 className="font-semibold text-fg">Créer une fiche vierge</h2>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-fg-muted" htmlFor="title">
            Titre
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Création..." : "Créer et éditer"}
        </button>
      </form>

      <ImportDropzone folder={folders[folderIndex]} />
    </div>
  );
}
