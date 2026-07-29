import Link from "next/link";
import { listTree } from "@/lib/content/fs";
import { TreeView } from "@/components/sidebar/TreeView";
import { requireUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/LogoutButton";
import { SearchBar } from "@/components/SearchBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [tree, user] = await Promise.all([listTree(), requireUser()]);

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-neutral-800 p-3">
        <Link href="/" className="mb-4 block text-lg font-semibold">
          Le Grimoire
        </Link>
        <TreeView nodes={tree} />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
          <nav className="flex items-center gap-4 text-sm text-neutral-400">
            <Link href="/new" className="hover:text-neutral-100">
              + Nouvelle fiche
            </Link>
            <Link href="/folders" className="hover:text-neutral-100">
              Gérer les dossiers
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <SearchBar />
            <span className="text-sm text-neutral-400">Connecté en tant que {user.username}</span>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
