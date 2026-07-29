# Le Grimoire — Plan V1

## Contexte
Knowledge base interne pour une équipe de pentest : fiches Markdown organisées par dossiers thématiques (web, AD, network, privesc...), consultables et éditables par toute l'équipe.

Décisions validées :
- **Stockage** : fichiers `.md` bruts sur disque (pas de Git backend, pas de DB pour le contenu).
- **Stack** : Next.js (TypeScript, App Router), service unique déployable en Docker.
- **Auth** : comptes simples login/mot de passe, gérés par l'app.
- **Template de fiche** : minimal (H1 + contenu libre, pas de frontmatter imposé).
- **Périmètre V1** : lecture + navigation arborescence, édition en ligne, upload de fiches + gestion de dossiers, recherche full-text basique.

## Décisions techniques

| Sujet | Choix | Pourquoi |
|---|---|---|
| Scaffold | `create-next-app` (TS, App Router, Tailwind, ESLint, sans `src/`) | UI rapide (tree view, éditeur, modals) sans lib de composants lourde |
| Rendu Markdown | `unified` côté serveur : `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-slug` + `rehype-highlight` + `rehype-sanitize` + `rehype-stringify` | Zéro JS de rendu client ; sanitize protège contre du Markdown malveillant stocké |
| Éditeur | `@uiw/react-md-editor` (Client Component, `dynamic(ssr:false)`) | Split éditeur/preview + coloration syntaxique, une seule dépendance |
| Auth | Maison : `bcryptjs` + `iron-session` (cookie chiffré, stateless) | Un seul mode de connexion, facile à auditer |
| Secret de session | `SESSION_SECRET` optionnel — auto-généré et persisté dans `data/.session-secret` si absent | Évite une étape manuelle (`.env` + `openssl rand`) pour un outil qui doit rester simple à démarrer |
| DB utilisateurs + recherche | SQLite via `better-sqlite3` (sans ORM), table `users` + table virtuelle FTS5 `fiches_fts` | Schéma trivial, synchrone, pas de serveur à faire tourner |
| Mutations | Route Handlers (`app/api/**/route.ts`) | Uniformité, gère l'upload multipart nativement |
| Concurrence d'édition | Contrôle optimiste via `mtime` (409 si conflit) | Évite l'écrasement silencieux sans vrai lock |
| Création de compte | CLI (`scripts/create-user.ts`), pas d'auto-inscription | Pas de flux d'inscription à sécuriser |

## Sécurité : path traversal
Toute route touchant au disque passe par `lib/content/paths.ts` : slugification obligatoire, rejet de `.`/`..`/séparateurs par segment, vérification finale que le chemin résolu reste sous `CONTENT_ROOT`. Fiches forcées en `.md`, dossiers sans point.

## Arborescence du projet
```
grimoire/
├── app/
│   ├── login/page.tsx
│   ├── (app)/                        # protégé par proxy.ts
│   │   ├── layout.tsx                # sidebar TreeView + topbar SearchBar
│   │   ├── fiche/[...path]/page.tsx        # lecture
│   │   ├── edit/[...path]/page.tsx         # édition (route sœur : Next.js interdit un segment
│   │   │                                   # statique après un catch-all dans le même sous-arbre)
│   │   ├── new/page.tsx
│   │   ├── folders/page.tsx
│   │   └── search/page.tsx
│   └── api/
│       ├── auth/{login,logout}/route.ts
│       ├── tree/route.ts
│       ├── fiches/route.ts                 # POST création
│       ├── fiches/[...path]/route.ts       # GET / PUT / DELETE
│       ├── upload/route.ts
│       ├── folders/route.ts                # POST / PATCH / DELETE
│       └── search/route.ts
├── lib/
│   ├── auth/{session.ts, password.ts}
│   ├── content/{paths.ts, fs.ts, slugify.ts, markdown.ts}
│   ├── db/{client.ts, users.ts, search.ts}
│   └── validation.ts                 # zod
├── components/{sidebar/, editor/, viewer/, SearchBar.tsx}
├── proxy.ts
├── scripts/{create-user.ts, reindex.ts}
├── content/                          # données runtime, gitignored
├── data/                             # grimoire.db, gitignored
├── Dockerfile
└── docker-compose.yml
```

## Modèle de données
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE fiches_fts USING fts5(
  path, title, content, folder UNINDEXED
);
```
Pas de rôles — tous les comptes ont les mêmes droits.

## Hors périmètre V1
Upload d'images inline, rôles/permissions, historique de versions, drag & drop.

---

## Tâches, étape par étape

### Étape 1 — Scaffold
- [x] `create-next-app` (TS, App Router, Tailwind, ESLint, sans `src/`)
- [x] `.gitignore` : `content/`, `data/`, `.env*`
- [x] Vérif : `npm run dev` sert la page par défaut

### Étape 2 — Fondations disque + DB
- [x] Créer `content/`, `data/` (avec `.gitkeep`)
- [x] `lib/content/paths.ts` (résolution sûre des chemins)
- [x] `lib/db/client.ts` (instance `better-sqlite3` + init schéma, `getDb()` crée le schéma tout seul
      au premier accès via `CREATE TABLE IF NOT EXISTS` — pas besoin d'un script d'init séparé)
- [x] Vérif : premier appel à `getDb()` (via `create-user.ts`) crée bien `users`/`fiches_fts`

### Étape 3 — Auth
- [x] `lib/auth/password.ts` (hash/verify bcrypt)
- [x] `lib/auth/session.ts` (iron-session, `getSession`, `requireUser`)
- [x] `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`
- [x] `app/login/page.tsx`
- [x] `proxy.ts` (protège tout sauf `/login` et `/api/auth/login`) — renommé depuis `middleware.ts`, convention Next.js 16
- [x] `scripts/create-user.ts`
- [x] Vérif : créer un compte en CLI, login/logout, accès refusé sans session

### Étape 4 — Lecture + navigation
- [x] `lib/content/slugify.ts`
- [x] `lib/content/fs.ts` (listTree, readFiche)
- [x] `lib/content/markdown.ts` (pipeline unified)
- [x] `app/api/tree/route.ts`, `app/api/fiches/[...path]/route.ts` (GET)
- [x] `components/sidebar/TreeView.tsx`
- [x] `app/(app)/layout.tsx`, `app/(app)/fiche/[...path]/page.tsx`
- [x] Fiches d'exemple dans `content/web/`, `content/ad/`
- [x] Vérif : sidebar + rendu Markdown (tableaux, code coloré, ancres) corrects + anti path-traversal validé

### Étape 5 — Édition
- [x] `lib/content/fs.ts` : writeFiche (avec contrôle `mtime`)
- [x] `app/api/fiches/[...path]/route.ts` (PUT, 409 si conflit)
- [x] `components/editor/MarkdownEditor.tsx`
- [x] `app/(app)/edit/[...path]/page.tsx`
- [x] Vérif : sauvegarde reflétée sur disque ; conflit mtime détecté (409, aucune écrasement)

### Étape 6 — Création, upload, dossiers
- [x] `app/api/fiches/route.ts` (POST création)
- [x] `app/api/upload/route.ts`
- [x] `app/api/folders/route.ts` (POST/PATCH/DELETE)
- [x] `app/(app)/new/page.tsx`, `app/(app)/folders/page.tsx`
- [x] Vérif : création/upload (+ extension refusée)/renommage/déplacement (dont vers la racine)/suppression fonctionnels ; tentative de path traversal rejetée en 400

### Étape 7 — Recherche
- [x] `lib/db/search.ts` — `reindexAll()` (rebuild complet, plus simple/robuste qu'un patch incrémental
      vu le volume attendu) + `searchFiches()` avec snippet basé sur des marqueurs de contrôle
      (rendu en vrais nœuds React, jamais `dangerouslySetInnerHTML`, pour éviter toute injection
      via du contenu de fiche non fiable)
- [x] Indexation branchée sur chaque mutation (PUT fiche, POST fiche, POST upload, PATCH/DELETE folders)
- [x] `scripts/reindex.ts` + `instrumentation.ts` (reindex complet à chaque démarrage du serveur)
- [x] `app/api/search/route.ts`
- [x] `components/SearchBar.tsx`, `app/(app)/search/page.tsx`
- [x] Vérif : terme trouvé dans le corps d'une fiche ; plus trouvé après suppression du terme + sauvegarde,
      nouveau terme ajouté retrouvé immédiatement

### Étape 8 — Docker
- [x] `Dockerfile` multi-stage non-root (image `node:20-bookworm-slim`, pas Alpine, pour la
      compatibilité des binaires précompilés de `better-sqlite3`)
- [x] `docker-compose.yml` (volumes `content/` + `data/`)
- [x] `.dockerignore`
- [~] Vérif : **non exécutée** — pas d'accès au démon Docker dans ce sandbox (utilisateur hors du
      groupe `docker`, sudo non interactif). À valider manuellement : `docker compose build && docker compose up`,
      puis `docker compose exec grimoire npx tsx scripts/create-user.ts <user> <pass>`, contenu et
      comptes toujours présents après `docker compose restart`.
- Écart assumé par rapport au plan initial : **pas de sortie `output: "standalone"`**. Cette
  sortie élague `node_modules` à ce que le serveur Next.js trace automatiquement, ce qui casse
  l'exécution des scripts d'admin (`scripts/create-user.ts`, `scripts/reindex.ts`) via `npx tsx`
  dans le conteneur. L'image finale embarque donc les sources et `node_modules` complets ;
  compromis assumé pour rester simple à opérer, au prix d'une image un peu plus grosse.

### Étape 9 — Durcissement léger
- [x] Rate-limit basique sur `/api/auth/login` (`lib/auth/rate-limit.ts`, en mémoire, 10 tentatives / 5 min
      par IP) — vérifié : 401 sur les 10 premières tentatives, 429 ensuite
- [x] Cookie session `httpOnly` + `sameSite=lax` + `secure` en prod (déjà en place depuis l'étape 3,
      `lib/auth/session.ts`)
- [x] Limite de taille d'upload vérifiée côté serveur (2 Mo, `app/api/upload/route.ts`) — vérifié :
      upload de 3 Mo rejeté en 400, rien écrit sur disque
