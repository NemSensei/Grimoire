# Le Grimoire

Knowledge base interne pour équipe de pentest : fiches Markdown organisées par dossiers
thématiques (web, AD, network, privesc…), consultables, éditables et gérables directement
depuis le navigateur par toute l'équipe.

## Fonctionnalités

- **Lecture & navigation** — rendu Markdown (GFM : tableaux, listes de tâches…) avec
  coloration syntaxique des blocs de code, navigation par arborescence de dossiers, contenu qui
  s'adapte à l'écran (pas de scroll horizontal — les tableaux larges restent une exception
  volontaire, avec leur propre scroll local)
- **Édition en ligne** — éditeur Markdown avec preview, sauvegarde directe sur disque,
  détection de conflit si la fiche a été modifiée entre-temps par quelqu'un d'autre
- **Images** — coller un screenshot depuis le presse-papiers directement dans l'éditeur, ou
  uploader un fichier, avec insertion automatique du Markdown correspondant
- **Création rapide** — nouveau dossier ou nouvelle fiche vierge en un clic depuis
  l'arborescence (boutons au survol), ou depuis `/new`
- **Import par lot** — glisser-déposer un ou plusieurs fichiers `.md`, ou un dossier entier
  (imbriqué), en conservant la structure de sous-dossiers
- **Organisation** — glisser-déposer des fiches et dossiers directement dans l'arborescence pour
  les réorganiser ; renommer, déplacer, supprimer depuis `/folders`
- **Recherche full-text** — sur le titre et le contenu de toutes les fiches
- **Multi-utilisateurs** — comptes simples login/mot de passe

## Stack technique

| | |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router, TypeScript) |
| Stockage des fiches | Fichiers `.md` bruts sur disque (pas de base de données pour le contenu) |
| Comptes & recherche | SQLite (`better-sqlite3`) — table `users` + index full-text FTS5 |
| Auth | Sessions chiffrées (`iron-session`) + `bcryptjs` |
| Rendu Markdown | `unified` / `remark` / `rehype`, sanitizé côté serveur |
| Éditeur | `@uiw/react-md-editor` |
| Style | Tailwind CSS |

Voir [PLAN.md](PLAN.md) pour le détail des choix d'architecture et l'avancement des étapes.

## Démarrage rapide

Prérequis : Node.js 20+. Aucune configuration requise — la base SQLite et le secret de
session sont créés automatiquement au premier démarrage.

```bash
npm install
npx tsx scripts/create-user.ts <identifiant> <mot-de-passe>
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) et se connecter avec le compte créé.

### Variables d'environnement (toutes optionnelles)

| Variable | Description |
|---|---|
| `SESSION_SECRET` | Secret de chiffrement des sessions. Auto-généré et persisté dans `data/.session-secret` si absent. |
| `CONTENT_DIR` | Dossier des fiches Markdown (défaut : `./content`) |
| `DB_PATH` | Chemin de la base SQLite (défaut : `./data/grimoire.db`) |

Voir [.env.example](.env.example).

## Déploiement (Docker)

```bash
docker compose build
docker compose up -d
docker compose exec grimoire npx tsx scripts/create-user.ts <identifiant> <mot-de-passe>
```

Les fiches (`./content`) et la base SQLite (`./data`) sont montées en volumes sur l'hôte : le
contenu survit aux redémarrages et mises à jour du conteneur.

Le conteneur écoute sur `127.0.0.1:43217` (pas exposé directement sur internet — adapter le port
dans `docker-compose.yml` si besoin, par exemple en cas de conflit avec un autre service). Prévoir
un reverse proxy (Apache/nginx/Caddy) devant pour le HTTPS : le cookie de session est marqué
`secure` en production, donc l'authentification ne fonctionnera pas en HTTP simple.

## Gestion des comptes

Pas d'auto-inscription : les comptes sont créés en ligne de commande par un administrateur.

```bash
npx tsx scripts/create-user.ts <identifiant> <mot-de-passe>
```

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Démarre le build de production |
| `npm run lint` | Lint (ESLint) |
| `npx tsx scripts/create-user.ts <user> <pass>` | Crée un compte utilisateur (crée aussi la base SQLite si besoin) |
| `npx tsx scripts/reindex.ts` | Reconstruit l'index de recherche (exécuté aussi automatiquement au démarrage) |

## Structure du projet

```
app/              Pages et routes API (Next.js App Router)
  api/
    fiches/       Lecture, création, édition
    folders/      Créer / renommer / déplacer / supprimer dossiers et fiches
    import/       Import par lot (fichiers et/ou dossiers déposés)
    assets/       Upload et service des images
    search/       Recherche full-text
components/       Composants React (éditeur, arborescence, dropzones, recherche…)
lib/
  auth/           Sessions, mots de passe, rate-limit
  content/        Lecture/écriture des fiches et images, résolution sûre des chemins, rendu Markdown
  db/             Client SQLite, index de recherche
  client/         Petits utilitaires côté navigateur (upload, drag-and-drop, fetch JSON)
scripts/          Scripts d'administration (création de compte, reindex)
content/          Fiches Markdown et images (non versionné, données runtime)
data/             Base SQLite (non versionné, données runtime)
```

## Sécurité

- Toute route qui touche au disque passe par une résolution de chemin qui rejette
  slugs invalides, `..` et séparateurs, et vérifie que le chemin final reste sous le
  dossier de contenu (protection contre le path traversal)
- Rendu Markdown sanitizé côté serveur (`rehype-sanitize`)
- Images validées par signature binaire (magic bytes), pas par extension ou Content-Type déclaré
  par le navigateur — SVG exclu (risque XSS), 8 Mo max
- Cookies de session `httpOnly`, `sameSite=lax`, `secure` en production
- Rate-limit basique sur la connexion

## Licence

[MIT](LICENSE)
