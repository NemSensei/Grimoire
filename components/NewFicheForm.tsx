"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImportDropzone } from "@/components/ImportDropzone";

function folderLabel(folder: string[]): string {
  return folder.length === 0 ? "/ (racine)" : folder.join("/");
}

export function NewFicheForm({ folders }: { folders: string[][] }) {
  const router = useRouter();
  const [folderIndex, setFolderIndex] = useState(0);
  const [title, setTitle] = useState("");
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
    <div className="max-w-md space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Nouvelle fiche</h1>
      </div>

      <div className="space-y-1">
        <label className="block text-sm text-neutral-400" htmlFor="folder">
          Dossier
        </label>
        <select
          id="folder"
          value={folderIndex}
          onChange={(e) => setFolderIndex(Number(e.target.value))}
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
        >
          {folders.map((folder, i) => (
            <option key={folder.join("/")} value={i}>
              {folderLabel(folder)}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-neutral-800 p-4">
        <h2 className="text-sm font-medium text-neutral-300">Créer une fiche vierge</h2>
        <div className="space-y-1">
          <label className="block text-sm text-neutral-400" htmlFor="title">
            Titre
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {saving ? "Création..." : "Créer et éditer"}
        </button>
      </form>

      <ImportDropzone folder={folders[folderIndex]} />
    </div>
  );
}
