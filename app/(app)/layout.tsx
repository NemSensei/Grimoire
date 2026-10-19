import Link from "next/link";
import { listTree } from "@/lib/content/fs";
import { TreeView } from "@/components/sidebar/TreeView";
import { requireUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/LogoutButton";
import { SearchDialog } from "@/components/shell/SearchDialog";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { MobileNav } from "@/components/shell/MobileNav";
import { BookIcon, PlusIcon, SettingsIcon } from "@/components/icons";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [tree, user] = await Promise.all([listTree(), requireUser()]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center gap-3 px-4 lg:px-6">
          <MobileNav>
            <TreeView nodes={tree} />
          </MobileNav>

          <Link href="/" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight lg:w-64">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <BookIcon width={15} height={15} />
            </span>
            <span className="hidden sm:inline">Le Grimoire</span>
          </Link>

          <div className="flex min-w-0 flex-1 justify-center">
            <SearchDialog />
          </div>

          <nav className="flex shrink-0 items-center gap-1">
            <Link
              href="/new"
              className="mr-1 hidden items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 md:flex"
            >
              <PlusIcon width={15} height={15} />
              Nouvelle fiche
            </Link>
            <Link
              href="/folders"
              title="Gérer les dossiers"
              aria-label="Gérer les dossiers"
              className="rounded-md p-2 text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
            >
              <SettingsIcon />
            </Link>
            <ThemeToggle />
            <span
              title={`Connecté en tant que ${user.username}`}
              className="mx-1 hidden h-7 w-7 items-center justify-center rounded-full bg-bg-muted text-xs font-semibold uppercase text-fg-muted sm:flex"
            >
              {user.username.slice(0, 2)}
            </span>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-[90rem]">
        <aside className="thin-scroll sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r border-border px-4 py-6 lg:block">
          <TreeView nodes={tree} />
        </aside>
        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">{children}</main>
      </div>
    </div>
  );
}
