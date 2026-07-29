/**
 * Rate-limit en mémoire, volontairement basique (une seule instance de l'app, pas de Redis).
 * Suffisant pour dissuader le bruteforce sur /api/auth/login sur un outil interne à petite équipe.
 */
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

interface Entry {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, Entry>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
