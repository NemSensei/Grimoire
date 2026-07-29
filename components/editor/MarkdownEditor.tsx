"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface Props {
  segments: string[];
  initialContent: string;
  initialMtimeMs: number;
}

export function MarkdownEditor({ segments, initialContent, initialMtimeMs }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const ficheHref = `/fiche/${segments.map(encodeURIComponent).join("/")}`;
  const apiPath = `/api/fiches/${segments.map(encodeURIComponent).join("/")}`;

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

  return (
    <div className="flex flex-col gap-4" data-color-mode="dark">
      <div className="flex items-center justify-between">
        <a href={ficheHref} className="text-sm text-neutral-400 hover:text-neutral-100">
          ← Annuler
        </a>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-neutral-100 px-4 py-1.5 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      </div>

      {conflict && (
        <p className="rounded border border-amber-700 bg-amber-950 px-3 py-2 text-sm text-amber-300">
          Cette fiche a été modifiée par quelqu&apos;un d&apos;autre depuis son ouverture. Rechargez la page pour
          récupérer la dernière version avant de continuer.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <MDEditor value={value} onChange={(v) => setValue(v ?? "")} height={600} />
    </div>
  );
}
