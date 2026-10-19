import { listTree, type TreeNode } from "@/lib/content/fs";
import { NewFicheForm } from "@/components/NewFicheForm";

function collectFolders(nodes: TreeNode[]): string[][] {
  const folders: string[][] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      folders.push(node.path);
      folders.push(...collectFolders(node.children));
    }
  }
  return folders;
}

export default async function NewFichePage({ searchParams }: { searchParams: Promise<{ title?: string }> }) {
  // Lien [[…]] vers une fiche inexistante : on arrive ici avec le titre déjà proposé.
  const { title } = await searchParams;
  const tree = await listTree();
  const folders = [[], ...collectFolders(tree)];
  return <NewFicheForm folders={folders} initialTitle={title ?? ""} />;
}
