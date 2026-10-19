"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TreeNode } from "@/lib/content/fs";
import { slugify } from "@/lib/content/slugify";
import { postJson } from "@/lib/client/post-json";
import { folderLabel as prettyName } from "@/lib/content/labels";
import { FileIcon, FolderIcon, PlusIcon } from "@/components/icons";

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
      <li key={node.path.join("/")}>
        <div
          className="group flex items-center gap-2 rounded-lg py-1.5 pr-2 text-sm transition-colors hover:bg-bg-subtle"
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
        >
          {isFolder ? (
            <FolderIcon className="shrink-0 text-accent" />
          ) : (
            <FileIcon className="shrink-0 text-fg-subtle" />
          )}
          <span className={`flex-1 truncate ${isFolder ? "font-medium text-fg" : "text-fg-muted"}`}>
            {isFolder ? prettyName(node.name) : node.title}
          </span>

          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value !== "") handleMove(node, JSON.parse(e.target.value) as string[]);
              e.target.value = "";
            }}
            className="rounded-md border border-border bg-bg px-1.5 py-1 text-xs text-fg-muted"
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

          <button onClick={() => handleRename(node)} className="rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg">
            Renommer
          </button>
          {isFolder && (
            <button
              onClick={() => handleCreateFolder(node.path)}
              className="rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
            >
              + Sous-dossier
            </button>
          )}
          <button onClick={() => handleDelete(node)} className="rounded-md px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400">
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
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion des dossiers</h1>
          <p className="mt-2 text-fg-muted">Renommer, déplacer ou supprimer fiches et dossiers.</p>
        </div>
        <button
          onClick={() => handleCreateFolder([])}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
        >
          <PlusIcon width={15} height={15} />
          Nouveau dossier à la racine
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {tree.length === 0 ? (
        <p className="text-sm text-fg-subtle">Aucun dossier ni fiche pour l’instant.</p>
      ) : (
        <ul className="rounded-xl border border-border p-2">{tree.map((node) => renderNode(node, 0))}</ul>
      )}
    </div>
  );
}
