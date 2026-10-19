# Le Grimoire

Base de connaissances web pour une équipe de pentest. Fiches Markdown organisées par dossiers
thématiques (web, AD, network, privesc…), consultables et éditables directement depuis le
navigateur. Déploiement interne, multi-utilisateurs, sans rôles.

## Fonctionnalités

- **Lecture** — interface façon GitBook (thème clair/sombre, sommaire, fil d'Ariane), rendu
  Markdown (GFM) avec coloration syntaxique, encadrés `> [!NOTE]` et `{% hint %}`.
- **Édition en ligne** — éditeur CodeMirror coloré façon Obsidian, modes édition / côte à côte /
  aperçu, barre d'outils, Ctrl+S, détection de conflit et signalement de l'édition concurrente.
- **Liens entre fiches** — `[[fiche]]`, `[[fiche#Section]]`, `[[fiche|libellé]]` avec
  autocomplétion, et section « Référencée par » sur chaque fiche.
- **Historique** — chaque modification est versionnée avec son auteur (dépôt git interne dans
  `content/`) : comparaison des versions, restauration, corbeille des fiches supprimées.
- **Images** — collage, glisser-déposer ou upload, insertion automatique du Markdown.
- **Création & import** — fiche ou dossier en un clic ; import par glisser-déposer de fichiers
  `.md` ou de dossiers entiers (structure préservée).
- **Organisation** — glisser-déposer dans l'arborescence, renommage, déplacement, suppression.
- **Recherche** — full-text instantanée sur titre et contenu (SQLite FTS5), palette Ctrl+K.
- **Multi-utilisateurs** — comptes login/mot de passe, créés en CLI (pas d'auto-inscription).

## Stack

| | |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router, TypeScript) |
| Fiches | Fichiers `.md` bruts sur disque (pas de base de données pour le contenu) |
| Comptes & recherche | SQLite (`better-sqlite3`) — table `users`, index FTS5, table des liens |
| Historique | `git` (dépôt interne dans `content/`, géré par l'application) |
| Auth | Sessions chiffrées (`iron-session`) + `bcryptjs` |
| Rendu Markdown | `unified` / `remark` / `rehype`, sanitizé côté serveur |
| Éditeur | CodeMirror 6 · Style : Tailwind CSS |

## Démarrage

Prérequis : Node.js 20+. Aucune configuration requise (base SQLite et secret de session créés
automatiquement au premier démarrage).

```bash
npm install
npx tsx scripts/create-user.ts <identifiant>   # mot de passe demandé de façon masquée
npm run dev
```

Puis [http://localhost:3000](http://localhost:3000).

### Variables d'environnement (optionnelles)

| Variable | Défaut | Rôle |
|---|---|---|
| `SESSION_SECRET` | auto-généré dans `data/.session-secret` | Secret de chiffrement des sessions (≥ 32 caractères si défini) |
| `CONTENT_DIR` | `./content` | Dossier des fiches Markdown |
| `DB_PATH` | `./data/grimoire.db` | Chemin de la base SQLite |

Voir [.env.example](.env.example).

## Déploiement (Docker)

Le conteneur tourne en utilisateur non-root (uid/gid `1001`) : les dossiers montés doivent lui
appartenir avant le premier démarrage.

```bash
mkdir -p content data
sudo chown -R 1001:1001 content data

docker compose build
docker compose up -d
docker compose exec grimoire npx tsx scripts/create-user.ts <identifiant>
```

> Selon la version de Docker, utiliser `docker compose` (V2) ou `docker-compose` (V1).

`content/` et `data/` sont montés en volumes : le contenu survit aux redémarrages. Le conteneur
écoute sur `127.0.0.1:43217` (voir `docker-compose.yml`) — **jamais exposé directement sur
internet**. Prévoir un reverse proxy TLS devant : le cookie de session est `secure` en production,
l'authentification ne fonctionne donc pas en HTTP simple.

<details>
<summary>Exemple de vhost Apache</summary>

```apache
<VirtualHost *:443>
  ServerName grimoire.exemple.tld
  ProxyPass / http://127.0.0.1:43217/
  ProxyPassReverse / http://127.0.0.1:43217/
  ProxyPreserveHost On
  SSLEngine On
  SSLCertificateFile /chemin/vers/grimoire.crt
  SSLCertificateKeyFile /chemin/vers/grimoire.key
</VirtualHost>
```
</details>

### Dépannage

- **`SQLITE_CANTOPEN`** (`docker compose logs grimoire`) — permissions sur `content/`/`data/`,
  voir le `chown` ci-dessus.
- **Build figé sans sortie** — `better-sqlite3` compile un module natif au premier `npm install`
  (plusieurs minutes). Vérifier l'accès réseau sortant du conteneur avant de conclure à un blocage.
- **Port déjà utilisé** — changer le port hôte dans `docker-compose.yml`
  (`"127.0.0.1:<port>:3000"`).

## Comptes

Pas d'auto-inscription : les comptes sont créés en CLI par un administrateur. Le mot de passe est
demandé de façon interactive (saisie masquée + confirmation), jamais passé en argument — il ne
finit donc ni dans l'historique du shell ni dans `ps`.

```bash
npx tsx scripts/create-user.ts <identifiant>
```

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Démarre le build de production |
| `npm run lint` | Lint (ESLint) |
| `npx tsx scripts/create-user.ts <user>` | Crée un compte (mot de passe demandé, masqué) |
| `npx tsx scripts/reindex.ts` | Reconstruit l'index de recherche (aussi lancé au démarrage) |

## Structure

```
app/            Pages et routes API (App Router)
  api/          fiches · folders · import · assets · locks · search
components/      Éditeur, arborescence, dropzones, recherche
lib/
  auth/         Sessions, mots de passe, rate-limit
  content/      Lecture/écriture fiches & images, verrou d'édition, chemins sûrs, rendu Markdown
  db/           Client SQLite, index de recherche
  client/       Utilitaires navigateur (upload, drag-and-drop, fetch)
scripts/        Administration (création de compte, reindex)
content/        Fiches & images — données runtime, non versionné
data/           Base SQLite — données runtime, non versionné
```

## Sécurité

- Résolution de chemin centralisée rejetant `..`, séparateurs et slugs invalides, et vérifiant que
  le chemin final reste sous le dossier de contenu (anti path-traversal).
- Rendu Markdown sanitizé côté serveur (`rehype-sanitize`).
- Aucun segment de chemin caché (`.git`...) n'est accepté. git est appelé sans shell, en ignorant
  la configuration git de la machine (pas de hooks ni de signature hérités).
- Images validées par signature binaire (magic bytes), pas par extension ni Content-Type déclaré —
  SVG exclu (XSS), 8 Mo max.
- Cookies de session `httpOnly`, `sameSite=lax`, `secure` en production.
- Rate-limit sur la connexion.
- Le dossier `data/` (hashs de mots de passe, texte des fiches) est créé en `700`.

Voir [PLAN.md](PLAN.md) pour les choix d'architecture et le journal des correctifs.

## Licence

[MIT](LICENSE)
