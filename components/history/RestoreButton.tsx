"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ficheHref } from "@/lib/content/labels";
import { postJson } from "@/lib/client/post-json";

interface Props {
  action: "restore" | "undelete";
  path: string[];
  sha: string;
  label: string;
  confirmMessage: string;
}

/** Restaure une version (ou une fiche supprimée), puis ouvre la fiche restaurée. */
export function RestoreButton({ action, path, sha, label, confirmMessage }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    if (!window.confirm(confirmMessage)) return;
    setBusy(true);
    setError(null);
    const result = await postJson("/api/history", "POST", { action, path, sha });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Erreur lors de la restauration");
      return;
    }
    router.push(ficheHref(path));
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void restore()}
        disabled={busy}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {busy ? "Restauration…" : label}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </span>
  );
}
