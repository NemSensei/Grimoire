import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const DB_PATH = path.resolve(process.env.DB_PATH ?? "./data/grimoire.db");

let db: Database.Database | null = null;

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS fiches_fts USING fts5(
      path, title, content, folder UNINDEXED
    );
  `);
}

export function getDb(): Database.Database {
  if (!db) {
    // 0o700 : la base contient les hashs de mots de passe et le texte intégral des fiches.
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true, mode: 0o700 });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}
