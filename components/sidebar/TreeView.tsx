"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { TreeNode } from "@/lib/content/fs";
import { slugify } from "@/lib/content/slugify";
import { postJson } from "@/lib/client/post-json";

const DRAG_PATH_MIME = "application/x-grimoire-path";
const DRAG_TYPE_MIME = "application/x-grimoire-type";

interface TreeActions {
  onCreateFolder: (parent: string[]) => void;
  onCreateFiche: (parent: string[]) => void;
  onDropEntry: (event: DragEvent, targetFolder: string[]) => void;
}

function handleDragStart(event: DragEvent, node: TreeNode) {
  event.dataTransfer.setData(DRAG_PATH_MIME, JSON.stringify(node.path));
  event.dataTransfer.setData(DRAG_TYPE_MIME, node.type);
  event.dataTransfer.effectAllowed = "move";
}

function CreateButtons({ parent, actions }: { parent: string[]; actions: TreeActions }) {
  return (
    <div className="hidden items-center gap-1 pr-1 group-hover:flex">
      <button
        type="button"
        title="Nouveau dossier ici"
        onClick={() => actions.onCreateFolder(parent)}
        className="rounded px-1 text-xs text-neutral-500 hover:text-neutral-100"
      >
        📁+
      </button>
      <button
        type="button"
        title="Nouvelle fiche ici"
        onClick={() => actions.onCreateFiche(parent)}
        className="rounded px-1 text-xs text-neutral-500 hover:text-neutral-100"
      >
        📄+
      </button>
    </div>
  );
}

function FolderNode({
  node,
  depth,
  actions,
}: {
  node: Extract<TreeNode, { type: "folder" }>;
  depth: number;
  actions: TreeActions;
}) {
  const [open, setOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  return (
    <li>
      <div
        className={`group flex items-center rounded ${
          dragOver ? "bg-neutral-700 ring-1 ring-inset ring-neutral-500" : "hover:bg-neutral-800"
        }`}
        style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          actions.onDropEntry(e, node.path);
        }}
      >
        <button
          type="button"
          draggable
          onDragStart={(e) => handleDragStart(e, node)}
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1 py-1 text-left text-sm text-neutral-300"
        >
          <span className="text-neutral-500">{open ? "▾" : "▸"}</span>
          {node.name}
        </button>
        <CreateButtons parent={node.path} actions={actions} />
      </div>
      {open && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeItem key={child.path.join("/")} node={child} depth={depth + 1} actions={actions} />
          ))}
        </ul>
      )}
    </li>
  );
}

function FicheNode({ node, depth }: { node: Extract<TreeNode, { type: "fiche" }>; depth: number }) {
  const pathname = usePathname();
  const href = `/fiche/${node.path.map(encodeURIComponent).join("/")}`;
  const active = pathname === href;

  return (
    <li>
      <Link
        href={href}
        draggable
        onDragStart={(e) => handleDragStart(e, node)}
        className={`block truncate rounded px-2 py-1 text-sm hover:bg-neutral-800 ${
          active ? "bg-neutral-800 text-neutral-50" : "text-neutral-400"
        }`}
        style={{ paddingLeft: `${depth * 0.75 + 1.25}rem` }}
      >
        {node.title}
      </Link>
    </li>
  );
}

function TreeItem({ node, depth, actions }: { node: TreeNode; depth: number; actions: TreeActions }) {
  return node.type === "folder" ? (
    <FolderNode node={node} depth={depth} actions={actions} />
  ) : (
    <FicheNode node={node} depth={depth} />
  );
}

export function TreeView({ nodes }: { nodes: TreeNode[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [rootDragOver, setRootDragOver] = useState(false);

  async function createFolder(parent: string[]) {
    const name = window.prompt("Nom du nouveau dossier :");
    if (!name) return;
    const result = await postJson("/api/folders", "POST", { path: [...parent, slugify(name)] });
    if (!result.ok) {
      setError(result.error ?? "Erreur");
      return;
    }
    setError(null);
    router.refresh();
  }

  async function createFiche(parent: string[]) {
    const title = window.prompt("Titre de la nouvelle fiche :");
    if (!title) return;
    const res = await fetch("/api/fiches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: parent, title }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    setError(null);
    router.push(`/edit/${(data.path as string[]).map(encodeURIComponent).join("/")}`);
  }

  async function dropEntry(event: DragEvent, targetFolder: string[]) {
    event.preventDefault();
    const raw = event.dataTransfer.getData(DRAG_PATH_MIME);
    if (!raw) return;

    let fromPath: string[];
    try {
      fromPath = JSON.parse(raw) as string[];
    } catch {
      return;
    }
    const fromType = event.dataTransfer.getData(DRAG_TYPE_MIME);

    const currentParent = fromPath.slice(0, -1);
    if (currentParent.join("/") === targetFolder.join("/")) return; // déjà à cet endroit

    if (fromType === "folder") {
      const prefix = fromPath.join("/");
      const target = targetFolder.join("/");
      if (target === prefix || target.startsWith(`${prefix}/`)) {
        setError("Impossible de déplacer un dossier dans lui-même ou l'un de ses sous-dossiers.");
        return;
      }
    }

    const lastSegment = fromPath[fromPath.length - 1];
    const result = await postJson("/api/folders", "PATCH", { from: fromPath, to: [...targetFolder, lastSegment] });
    if (!result.ok) {
      setError(result.error ?? "Erreur");
      return;
    }
    setError(null);
    router.refresh();
  }

  const actions: TreeActions = {
    onCreateFolder: createFolder,
    onCreateFiche: createFiche,
    onDropEntry: (event, targetFolder) => void dropEntry(event, targetFolder),
  };

  return (
    <div>
      <div
        className={`group mb-1 flex items-center justify-between rounded px-2 ${
          rootDragOver ? "bg-neutral-700 ring-1 ring-inset ring-neutral-500" : "hover:bg-neutral-800"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setRootDragOver(true);
        }}
        onDragLeave={() => setRootDragOver(false)}
        onDrop={(e) => {
          setRootDragOver(false);
          actions.onDropEntry(e, []);
        }}
      >
        <span className="py-1 text-xs uppercase tracking-wide text-neutral-500">Fiches</span>
        <CreateButtons parent={[]} actions={actions} />
      </div>

      {error && <p className="mb-1 px-2 text-xs text-red-400">{error}</p>}

      {nodes.length === 0 ? (
        <p className="px-2 py-1 text-sm text-neutral-500">Aucune fiche pour l’instant.</p>
      ) : (
        <ul className="space-y-0.5">
          {nodes.map((node) => (
            <TreeItem key={node.path.join("/")} node={node} depth={0} actions={actions} />
          ))}
        </ul>
      )}
    </div>
  );
}
