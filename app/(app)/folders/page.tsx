import { listTree } from "@/lib/content/fs";
import { FolderManager } from "@/components/FolderManager";

export default async function FoldersPage() {
  const tree = await listTree();
  return <FolderManager tree={tree} />;
}
