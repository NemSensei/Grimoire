"use client";

import { useRouter } from "next/navigation";
import { LogOutIcon } from "@/components/icons";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      title="Déconnexion"
      aria-label="Déconnexion"
      className="rounded-md p-2 text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
    >
      <LogOutIcon />
    </button>
  );
}
