import readline from "node:readline";
import { getDb } from "../lib/db/client";
import { hashPassword } from "../lib/auth/password";

/**
 * Lit le mot de passe sur stdin plutôt qu'en argument : un argument de ligne de commande
 * finit dans l'historique du shell et est visible par tous via `ps`.
 * En TTY la saisie est masquée ; sinon (stdin redirigé) on lit simplement la première ligne.
 */
function readPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
    if (process.stdin.isTTY) {
      process.stdout.write(prompt);
      // Masque l'écho des caractères saisis (le prompt est déjà affiché).
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
    }
    rl.question("", (answer) => {
      rl.close();
      if (process.stdin.isTTY) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const [, , username, extra] = process.argv;
  if (!username || extra) {
    console.error("Usage: npx tsx scripts/create-user.ts <username>");
    console.error("Le mot de passe est demandé de façon interactive (ou lu sur stdin).");
    process.exit(1);
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    console.error(`L'utilisateur "${username}" existe déjà`);
    process.exit(1);
  }

  const password = await readPassword("Mot de passe : ");
  if (password.length < 8) {
    console.error("Le mot de passe doit faire au moins 8 caractères");
    process.exit(1);
  }
  if (process.stdin.isTTY && (await readPassword("Confirmation : ")) !== password) {
    console.error("Les mots de passe ne correspondent pas");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, passwordHash);
  console.log(`Utilisateur "${username}" créé.`);
}

main();
