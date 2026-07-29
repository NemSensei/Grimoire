"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TreeNode } from "@/lib/content/fs";
import { slugify } from "@/lib/content/slugify";

function collectFolderPaths(nodes: TreeNode[]): string[][] {
  const folders: string[][] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      folders.push(node.path);
      folders.push(...collectFolderPaths(node.children));
    }
  }
  return folders;
}

function folderLabel(folder: string[]): string {
  return folder.length === 0 ? "/ (racine)" : folder.join("/");
}

async function postJson(url: string, method: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: data.error ?? "Erreur" };
}

export function FolderManager({ tree }: { tree: TreeNode[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const allFolders = [[], ...collectFolderPaths(tree)];

  async function run(action: Promise<{ ok: boolean; error?: string }>) {
    const result = await action;
    if (!result.ok) {
      setError(result.error ?? "Erreur");
    } else {
      setError(null);
      router.refresh();
    }
  }

  function handleCreateFolder(parent: string[]) {
    const name = window.prompt("Nom du nouveau dossier :");
    if (!name) return;
    void run(postJson("/api/folders", "POST", { path: [...parent, slugify(name)] }));
  }

  function handleRename(node: TreeNode) {
    const currentName = node.type === "fiche" ? node.title : node.name;
    const name = window.prompt("Nouveau nom :", currentName);
    if (!name) return;
    const parent = node.path.slice(0, -1);
    const newSegment = node.type === "fiche" ? `${slugify(name)}.md` : slugify(name);
    void run(postJson("/api/folders", "PATCH", { from: node.path, to: [...parent, newSegment] }));
  }

  function handleMove(node: TreeNode, target: string[]) {
    const lastSegment = node.path[node.path.length - 1];
    void run(postJson("/api/folders", "PATCH", { from: node.path, to: [...target, lastSegment] }));
  }

  function handleDelete(node: TreeNode) {
    const label = node.type === "fiche" ? node.title : node.name;
    const extra = node.type === "folder" ? " (le dossier doit être vide)" : "";
    if (!window.confirm(`Supprimer "${label}" ?${extra}`)) return;
    void run(postJson("/api/folders", "DELETE", { path: node.path }));
  }

  function renderNode(node: TreeNode, depth: number) {
    const isFolder = node.type === "folder";
    const parentKey = node.path.slice(0, -1).join("/");

    return (
      <li key={node.path.join("/")} className="py-1">
        <div className="flex items-center gap-2 text-sm" style={{ paddingLeft: `${depth}rem` }}>
          <span className="text-neutral-500">{isFolder ? "📁" : "📄"}</span>
          <span className="flex-1 truncate text-neutral-200">{isFolder ? node.name : node.title}</span>

          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value !== "") handleMove(node, JSON.parse(e.target.value) as string[]);
              e.target.value = "";
            }}
            className="rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5 text-xs text-neutral-400"
          >
            <option value="">Déplacer vers...</option>
            {allFolders
              .filter((f) => f.join("/") !== parentKey)
              .map((f) => (
                <option key={f.join("/")} value={JSON.stringify(f)}>
                  {folderLabel(f)}
                </option>
              ))}
          </select>

          <button onClick={() => handleRename(node)} className="text-xs text-neutral-400 hover:text-neutral-100">
            Renommer
          </button>
          {isFolder && (
            <button
              onClick={() => handleCreateFolder(node.path)}
              className="text-xs text-neutral-400 hover:text-neutral-100"
            >
              + Sous-dossier
            </button>
          )}
          <button onClick={() => handleDelete(node)} className="text-xs text-red-400 hover:text-red-300">
            Supprimer
          </button>
        </div>

        {isFolder && node.children.length > 0 && (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gestion des dossiers</h1>
        <button
          onClick={() => handleCreateFolder([])}
          className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900"
        >
          + Nouveau dossier à la racine
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {tree.length === 0 ? (
        <p className="text-sm text-neutral-500">Aucun dossier ni fiche pour l’instant.</p>
      ) : (
        <ul>{tree.map((node) => renderNode(node, 0))}</ul>
      )}
    </div>
  );
}
