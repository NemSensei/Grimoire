"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { collectDroppedFiles, type DroppedFile } from "@/lib/client/dropped-files";

interface ImportSummary {
  imported: string[][];
  skipped: { relativePath: string; reason: string }[];
}

export function ImportDropzone({ folder }: { folder: string[] }) {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function submitFiles(files: DroppedFile[]) {
    if (files.length === 0) return;
    setError(null);
    setSummary(null);
    setImporting(true);
    try {
      const body = new FormData();
      body.set("folder", JSON.stringify(folder));
      for (const { relativePath, file } of files) {
        body.append("files", file);
        body.append("relativePaths", relativePath);
      }

      const res = await fetch("/api/import", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'import");
        return;
      }

      setSummary(data as ImportSummary);
      router.refresh();
    } finally {
      setImporting(false);
    }
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const files = await collectDroppedFiles(event.dataTransfer);
    await submitFiles(files);
  }

  async function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    if (!list) return;
    const files: DroppedFile[] = Array.from(list).map((file) => ({ relativePath: file.name, file }));
    event.target.value = "";
    await submitFiles(files);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-5">
      <h2 className="font-semibold text-fg">Importer des fichiers ou un dossier</h2>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center text-sm transition-colors ${
          dragActive ? "border-accent bg-accent-soft text-accent" : "border-border text-fg-subtle"
        }`}
      >
        <p>
          Glissez-déposez des fichiers <code>.md</code> ou un dossier ici
        </p>
        <p className="mt-1 text-xs">ou</p>
        <label className="mt-1 inline-block cursor-pointer font-medium text-accent hover:underline">
          choisir des fichiers
          <input type="file" accept=".md" multiple className="hidden" onChange={handleInputChange} />
        </label>
      </div>

      {importing && <p className="text-sm text-fg-muted">Import en cours...</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {summary && (
        <div className="text-sm">
          <p className="text-fg-muted">{summary.imported.length} fiche(s) importée(s).</p>
          {summary.skipped.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-fg-subtle">
              {summary.skipped.map((s) => (
                <li key={s.relativePath}>
                  {s.relativePath} — {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
