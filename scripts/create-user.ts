import { getDb } from "../lib/db/client";
import { hashPassword } from "../lib/auth/password";

async function main() {
  const [, , username, password] = process.argv;
  if (!username || !password) {
    console.error("Usage: npx tsx scripts/create-user.ts <username> <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Le mot de passe doit faire au moins 8 caractères");
    process.exit(1);
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    console.error(`L'utilisateur "${username}" existe déjà`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, passwordHash);
  console.log(`Utilisateur "${username}" créé.`);
}

main();
