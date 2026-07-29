"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TreeNode } from "@/lib/content/fs";

function FolderNode({ node, depth }: { node: Extract<TreeNode, { type: "folder" }>; depth: number }) {
  const [open, setOpen] = useState(true);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm text-neutral-300 hover:bg-neutral-800"
        style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
      >
        <span className="text-neutral-500">{open ? "▾" : "▸"}</span>
        {node.name}
      </button>
      {open && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeItem key={child.path.join("/")} node={child} depth={depth + 1} />
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

function TreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  return node.type === "folder" ? <FolderNode node={node} depth={depth} /> : <FicheNode node={node} depth={depth} />;
}

export function TreeView({ nodes }: { nodes: TreeNode[] }) {
  if (nodes.length === 0) {
    return <p className="px-2 py-1 text-sm text-neutral-500">Aucune fiche pour l’instant.</p>;
  }

  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <TreeItem key={node.path.join("/")} node={node} depth={0} />
      ))}
    </ul>
  );
}
