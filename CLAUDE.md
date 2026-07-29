# Projet : Le Grimoire

## But
Knowledge base web pour une équipe de pentest. Fiches en Markdown organisées par dossiers
thématiques (web, AD, network, privesc…). Déployée sur un serveur interne ; chaque membre de
l'équipe s'y connecte pour consulter les fiches, les modifier, en importer/créer, et gérer
l'arborescence de dossiers.

V1 à V3 sont livrées et fonctionnelles. Voir [PLAN.md](PLAN.md) pour le détail des décisions
d'architecture, l'avancement étape par étape, et le journal des correctifs. Voir
[README.md](README.md) pour le démarrage, le déploiement Docker et la gestion des comptes.

## Principes
- Rester simple : préférer peu de dépendances et du code direct à l'abstraction anticipée.
- Rendu type wiki, navigation simple entre les fiches.
- Recherche full-text dans les fiches.
- Multi-utilisateurs, sans rôles (tous les comptes ont les mêmes droits).

## Stack
- Framework : Next.js (App Router, TypeScript)
- Fiches : fichiers `.md` bruts sur disque (`content/`), pas de base de données pour le contenu
- Comptes & recherche : SQLite (`better-sqlite3`) — table `users` + index full-text FTS5
- Auth : sessions chiffrées (`iron-session`) + `bcryptjs`, pas d'auto-inscription (comptes créés
  en CLI via `scripts/create-user.ts`)
- Rendu Markdown : `unified`/`remark`/`rehype`, sanitizé côté serveur (`rehype-sanitize`)
- Éditeur : `@uiw/react-md-editor`
- Style : Tailwind CSS

## Conventions
- **Anti path-traversal** : toute route qui touche au disque passe par
  `lib/content/paths.ts` (`resolveSafeFichePath`/`resolveSafeFolderPath`/`resolveSafeAssetPath`).
  Ne jamais construire un chemin disque à partir d'une entrée utilisateur sans passer par ces
  fonctions.
- **Slugification systématique** : les noms de fichiers/dossiers sur disque sont toujours dérivés
  via `lib/content/slugify.ts`, jamais le nom brut saisi par l'utilisateur.
- **Fiches sans template imposé** : une fiche, c'est un H1 + du contenu libre. Pas de
  frontmatter obligatoire, pas de structure de sections imposée.
- **Pas de Server Actions** : toutes les mutations passent par des Route Handlers
  (`app/api/**/route.ts`), y compris les uploads multipart.
- **`proxy.ts`** (pas `middleware.ts` — convention Next.js 16) protège tout sauf `/login` et
  `/api/auth/login`.
- **Images** validées par signature binaire (magic bytes), jamais par extension ou Content-Type
  déclaré par le client. SVG explicitement exclu (XSS).

@AGENTS.md
