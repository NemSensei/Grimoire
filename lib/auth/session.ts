import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { DB_PATH } from "@/lib/db/client";

export interface SessionData {
  userId?: number;
  username?: string;
}

const SECRET_PATH = path.join(path.dirname(DB_PATH), ".session-secret");

let cachedSecret: string | null = null;

/**
 * Utilise SESSION_SECRET si défini, sinon génère un secret aléatoire et le persiste dans
 * data/.session-secret (même dossier que la base SQLite, déjà monté en volume en Docker).
 * Évite d'imposer une étape manuelle (.env + openssl) pour un outil interne qui doit rester simple.
 */
function getSessionSecret(): string {
  if (cachedSecret) return cachedSecret;

  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }

  fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true });
  if (fs.existsSync(SECRET_PATH)) {
    cachedSecret = fs.readFileSync(SECRET_PATH, "utf-8").trim();
  } else {
    cachedSecret = crypto.randomBytes(32).toString("base64");
    fs.writeFileSync(SECRET_PATH, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

export function getSessionOptions(): SessionOptions {
  return {
    cookieName: "grimoire_session",
    password: getSessionSecret(),
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}

export class UnauthorizedError extends Error {}

export async function requireUser(): Promise<{ userId: number; username: string }> {
  const session = await getSession();
  if (!session.userId || !session.username) {
    throw new UnauthorizedError();
  }
  return { userId: session.userId, username: session.username };
}
