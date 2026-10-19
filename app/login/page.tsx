"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookIcon } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur de connexion");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-subtle px-4 text-fg">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-bg p-8 shadow-sm"
      >
        <div className="flex flex-col items-center gap-3 pb-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <BookIcon width={22} height={22} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Le Grimoire</h1>
            <p className="mt-1 text-sm text-fg-subtle">Connectez-vous pour accéder aux fiches</p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-fg-muted" htmlFor="username">
            Identifiant
          </label>
          <input
            id="username"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-fg-muted" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-3 py-2.5 font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
