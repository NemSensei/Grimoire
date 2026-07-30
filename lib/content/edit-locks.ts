/**
 * Verrou d'édition informatif, en mémoire — même pattern que lib/auth/rate-limit.ts.
 * Un verrou perdu au redémarrage du serveur est un comportement sain (pas de verrou fantôme),
 * cohérent avec l'hypothèse déjà assumée ailleurs dans le projet : une seule instance du serveur.
 */
const LOCK_TTL_MS = 90_000;

interface LockEntry {
  username: string;
  expiresAt: number;
}

const locks = new Map<string, LockEntry>();

function keyOf(segments: string[]): string {
  return segments.join("/");
}

export function acquireOrRefreshLock(
  segments: string[],
  username: string,
): { ok: true } | { ok: false; heldBy: string } {
  const key = keyOf(segments);
  const now = Date.now();
  const existing = locks.get(key);

  if (existing && existing.expiresAt > now && existing.username !== username) {
    return { ok: false, heldBy: existing.username };
  }

  locks.set(key, { username, expiresAt: now + LOCK_TTL_MS });
  return { ok: true };
}

export function releaseLock(segments: string[], username: string): void {
  const key = keyOf(segments);
  const existing = locks.get(key);
  if (existing && existing.username === username) {
    locks.delete(key);
  }
}
