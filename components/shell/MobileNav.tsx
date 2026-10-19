"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "@/components/icons";

/** Bouton + tiroir latéral qui porte l'arborescence sur les écrans étroits. */
export function MobileNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Fermeture automatique après navigation.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        className="rounded-md p-2 text-fg-muted hover:bg-bg-muted hover:text-fg lg:hidden"
      >
        <MenuIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="thin-scroll absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto border-r border-border bg-bg p-4 shadow-xl">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-md p-2 text-fg-muted hover:bg-bg-muted hover:text-fg"
              >
                <XIcon />
              </button>
            </div>
            {children}
          </aside>
        </div>
      )}
    </>
  );
}
