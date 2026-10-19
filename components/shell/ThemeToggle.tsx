"use client";

import { setTheme, useIsDark } from "@/lib/client/theme";
import { MoonIcon, SunIcon } from "@/components/icons";

export function ThemeToggle() {
  const dark = useIsDark();
  return (
    <button
      type="button"
      onClick={() => setTheme(!dark)}
      title={dark ? "Passer en thème clair" : "Passer en thème sombre"}
      aria-label="Changer de thème"
      className="rounded-md p-2 text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
