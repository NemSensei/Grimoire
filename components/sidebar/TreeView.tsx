"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { TreeNode } from "@/lib/content/fs";
import { slugify } from "@/lib/content/slugify";
import { folderLabel, ficheHref } from "@/lib/content/labels";
import { postJson } from "@/lib/client/post-json";
import { ChevronRightIcon, FilePlusIcon, FolderPlusIcon, BookIcon } from "@/components/icons";

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

function containsPath(node: TreeNode, pathname: string): boolean {
  if (node.type === "fiche") return ficheHref(node.path) === pathname;
  return node.children.some((child) => containsPath(child, pathname));
}

function CreateButtons({ parent, actions }: { parent: string[]; actions: TreeActions }) {
  const btn =
    "rounded p-1 text-fg-subtle transition-colors hover:bg-bg-muted hover:text-fg focus-visible:opacity-100";
  return (
    <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <button type="button" title="Nouveau dossier ici" onClick={() => actions.onCreateFolder(parent)} className={btn}>
        <FolderPlusIcon width={14} height={14} />
      </button>
      <button type="button" title="Nouvelle fiche ici" onClick={() => actions.onCreateFiche(parent)} className={btn}>
        <FilePlusIcon width={14} height={14} />
      </button>
    </div>
  );
}

function useDropZone(onDrop: (e: DragEvent) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        setOver(false);
        onDrop(e);
      },
    },
  };
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
  const pathname = usePathname();
  const hasActive = containsPath(node, pathname);
  const [open, setOpen] = useState(hasActive);
  const [prevHasActive, setPrevHasActive] = useState(hasActive);
  const drop = useDropZone((e) => actions.onDropEntry(e, node.path));

  // Navigation vers une fiche de ce dossier (lien, recherche, page suivante...) : on le déplie.
  if (hasActive !== prevHasActive) {
    setPrevHasActive(hasActive);
    if (hasActive) setOpen(true);
  }

  return (
    <li>
      <div
        className={`group flex items-center rounded-md transition-colors ${
          drop.over ? "bg-accent-soft ring-1 ring-inset ring-accent" : "hover:bg-bg-muted"
        }`}
        {...drop.props}
      >
        <button
          type="button"
          draggable
          onDragStart={(e) => handleDragStart(e, node)}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-2 text-left text-sm ${
            depth === 0 ? "font-semibold text-fg" : "font-medium text-fg-muted"
          }`}
        >
          <ChevronRightIcon
            width={14}
            height={14}
            className={`shrink-0 text-fg-subtle transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
          <span className="truncate">{folderLabel(node.name)}</span>
        </button>
        <CreateButtons parent={node.path} actions={actions} />
      </div>
      {open && node.children.length > 0 && (
        <ul className="my-0.5 ml-[0.95rem] space-y-px border-l border-border pl-2">
          {node.children.map((child) => (
            <TreeItem key={child.path.join("/")} node={child} depth={depth + 1} actions={actions} />
          ))}
        </ul>
      )}
    </li>
  );
}

function FicheNode({ node }: { node: Extract<TreeNode, { type: "fiche" }> }) {
  const pathname = usePathname();
  const href = ficheHref(node.path);
  const active = pathname === href;

  return (
    <li>
      <Link
        href={href}
        draggable
        onDragStart={(e) => handleDragStart(e, node)}
        aria-current={active ? "page" : undefined}
        className={`block truncate rounded-md px-2.5 py-1.5 text-sm transition-colors ${
          active ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:bg-bg-muted hover:text-fg"
        }`}
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
    <FicheNode node={node} />
  );
}

export function TreeView({ nodes }: { nodes: TreeNode[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);

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

  const rootDrop = useDropZone((e) => actions.onDropEntry(e, []));

  return (
    <nav aria-label="Arborescence des fiches" className="text-sm">
      <Link
        href="/"
        className={`mb-3 flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors ${
          pathname === "/" ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:bg-bg-muted hover:text-fg"
        }`}
      >
        <BookIcon width={15} height={15} />
        Accueil
      </Link>

      <div
        className={`group mb-1 flex items-center justify-between rounded-md pl-2.5 ${
          rootDrop.over ? "bg-accent-soft ring-1 ring-inset ring-accent" : ""
        }`}
        {...rootDrop.props}
      >
        <span className="py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-fg-subtle">Fiches</span>
        <CreateButtons parent={[]} actions={actions} />
      </div>

      {error && (
        <p className="mb-2 rounded-md bg-red-500/10 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {nodes.length === 0 ? (
        <p className="px-2.5 py-1 text-fg-subtle">Aucune fiche pour l’instant.</p>
      ) : (
        <ul className="space-y-px">
          {nodes.map((node) => (
            <TreeItem key={node.path.join("/")} node={node} depth={0} actions={actions} />
          ))}
        </ul>
      )}
    </nav>
  );
}
