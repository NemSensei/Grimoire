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
│       ├── import/route.ts                 # import par lot (fichiers et/ou dossiers déposés)
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
Upload d'images inline, rôles/permissions, historique de versions.
(Le drag & drop, initialement exclu, a été ajouté en V2 — voir plus bas.)

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
- [x] `app/api/upload/route.ts` (upload mono-fichier — **remplacée en V2** par `app/api/import/route.ts`, voir plus bas)
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
- [x] Limite de taille d'upload vérifiée côté serveur (2 Mo, alors dans `app/api/upload/route.ts`,
      désormais dans `app/api/import/route.ts` — voir V2) — vérifié : upload de 3 Mo rejeté en 400,
      rien écrit sur disque

---

## V2 — Import par drag-and-drop (fichiers + dossiers)

Remplace l'upload mono-fichier de l'étape 6 par un import **par lot**, avec support du dépôt
d'un dossier entier (structure de sous-dossiers conservée).

- [x] `lib/content/fs.ts` : `importFiches()` — écrit un lot séquentiellement (pas en parallèle,
      pour que l'anti-collision de `writeNewFiche` voie les fichiers déjà écrits plus tôt dans le
      même lot) ; `saveUploadedFiche` retirée (remplacée)
- [x] `app/api/import/route.ts` — remplace `app/api/upload/route.ts` (supprimée) ; filtre
      extension `.md` + taille (2 Mo) + nombre de fichiers (200 max) ; les fichiers rejetés sont
      renvoyés dans `skipped` (avec raison) plutôt que de faire échouer tout le lot
- [x] `lib/client/dropped-files.ts` — traversée récursive d'un drop via
      `DataTransferItem.webkitGetAsEntry()` / `FileSystemDirectoryReader` (boucle sur
      `readEntries()` jusqu'à vide), repli sur `dataTransfer.files` (à plat) si l'API est absente
- [x] `components/ImportDropzone.tsx` — zone de drop + bouton "choisir des fichiers", affiche un
      résumé (nombre importé + fichiers ignorés avec raison)
- [x] `components/NewFicheForm.tsx` — remplace l'ancien formulaire d'upload par `<ImportDropzone />`
- [x] Vérif côté serveur (curl, simule ce qu'envoie le client) : structure de sous-dossiers
      reconstruite correctement, fichier non-`.md` rejeté dans `skipped`, collision de noms au
      sein d'un même lot résolue en `-2.md`
- [ ] Vérif côté navigateur (glisser-déposer réel) : **non testée** — pas d'outil de contrôle
      navigateur dans ce sandbox ; à valider manuellement (`npm run dev`, glisser un dossier avec
      sous-dossiers sur `/new`)

Aucune nouvelle surface de risque : chaque segment de chemin relatif est slugifié puis validé par
`resolveSafeFichePath`/`resolveSafeFolderPath` (`lib/content/paths.ts`), inchangé depuis la V1.

Hors périmètre de ce lot : déposer directement sur un dossier de la sidebar
(`components/sidebar/TreeView.tsx`) plutôt que de choisir le dossier cible dans le `<select>`
de `/new`.

---

## V3 — Images (upload direct + coller un screenshot)

Insertion d'images dans les fiches : coller une capture depuis le presse-papiers directement
dans l'éditeur, ou choisir un fichier via un bouton — dans les deux cas, Markdown `![](...)`
inséré automatiquement.

- [x] `lib/content/paths.ts` — `IMAGE_EXTENSIONS` + `resolveSafeAssetPath()` (même pattern que
      `resolveSafeFichePath`, extension image au lieu de `.md`)
- [x] `lib/content/assets.ts` — `detectImageExtension()` (signature binaire/magic bytes : PNG,
      JPEG, GIF, WebP — pas de confiance dans l'extension ni le Content-Type déclarés par le
      navigateur, trivialement falsifiables), `saveImage()` (nom de fichier généré, jamais dérivé
      du nom original), `readAsset()`, limite 8 Mo
- [x] `app/api/assets/route.ts` (POST upload), `app/api/assets/[...path]/route.ts` (GET service,
      `Content-Type` dérivé de l'extension validée côté serveur, cache long — nom de fichier
      unique par upload donc sûr)
- [x] `lib/client/upload-image.ts` — wrapper fetch partagé
- [x] `components/editor/MarkdownEditor.tsx` — `onPaste` sur le textarea (via `textareaProps`,
      `@uiw/react-md-editor` encapsule un vrai `<textarea>`, pas CodeMirror) intercepte un item
      image du presse-papiers et insère au curseur (référence DOM capturée avant l'`await`,
      indépendante du cycle de vie du synthetic event React) ; bouton "+ Image" pour l'upload
      direct (insertion en fin de contenu, pas de position de curseur disponible hors d'un
      événement textarea)
- [x] Vérif côté serveur (curl) : PNG valide accepté et servi avec le bon `Content-Type` ;
      fichier `.txt` renommé `.png` rejeté (mauvaise signature) ; image > 8 Mo rejetée ; tentative
      de path traversal sur `GET /api/assets/...` rejetée en 400
- [ ] Vérif côté navigateur (collage réel, bouton upload) : **non testée** — pas d'outil de
      contrôle navigateur dans ce sandbox ; à valider manuellement

Hors périmètre V3 : garbage-collection des images orphelines (une image reste sur disque même si
la fiche qui la référence est supprimée ou éditée pour la retirer), redimensionnement/compression,
SVG (risque XSS, exclu volontairement), drag-and-drop d'image directement sur la zone de l'éditeur.

---

## Correctif — scroll horizontal sur les grandes fiches

Sur les fiches volumineuses, la page entière (sidebar comprise) devenait scrollable
horizontalement au lieu que le contenu s'adapte à l'écran.

**Cause** : bug classique de flexbox — le conteneur `flex-1` de la colonne principale
(`app/(app)/layout.tsx`) n'avait pas `min-w-0`, donc il refusait de rétrécir en dessous de la
largeur intrinsèque de son contenu (un bloc de code large, par ex.) et poussait toute la page à
s'élargir plutôt que de laisser le débordement local se gérer.

- [x] `app/(app)/layout.tsx` — `min-w-0` sur le conteneur flex de la colonne principale
- [x] `components/viewer/MarkdownView.tsx` — `break-words` sur l'article (texte/liens longs sans
      espaces se cassent au lieu de déborder) ; `prose-pre:whitespace-pre-wrap prose-pre:break-words`
      sur les blocs de code (retour à la ligne plutôt que scroll — préférence explicite de
      l'utilisateur : pas de scroll, contenu qui s'adapte)
- [x] `lib/content/markdown.ts` — nouveau plugin rehype (`rehypeWrapTables`, `unist-util-visit`)
      qui enveloppe chaque `<table>` dans `<div class="table-wrapper">` ; `app/globals.css` lui
      donne `overflow-x: auto`. **Exception assumée** : les tableaux GFM larges gardent un scroll
      cantonné à eux-mêmes plutôt que de wrapper leurs cellules, parce que forcer le texte des
      colonnes à la ligne rendrait un tableau à beaucoup de colonnes illisible — seul cet endroit
      précis peut encore scroller, jamais la page entière.
- [x] Vérif : script direct sur `renderMarkdown()` confirmant un seul `<div class="table-wrapper">`
      par tableau (pas de double-imbrication) ; rendu réel de `web/sqlmap-cheatsheet.md` confirmant
      `min-w-0` présent dans le HTML généré, `.table-wrapper` bien autour du `<table>`, et la règle
      CSS `.table-wrapper { overflow-x: auto; max-width: 100% }` livrée au navigateur
- [ ] Vérif visuelle réelle (plus de scroll horizontal sur la page, blocs de code qui wrappent) :
      **non testée** — pas d'outil de contrôle navigateur dans ce sandbox ; à valider manuellement

---

## Amélioration — création et déplacement directement dans l'arborescence

- [x] `components/sidebar/TreeView.tsx` — boutons "📁+"/"📄+" au survol de chaque dossier (et de
      la racine) pour créer un sous-dossier ou une fiche vierge sans passer par `/new`/`/folders`
      ; extraction de `postJson` (dupliqué avec `FolderManager.tsx`) vers `lib/client/post-json.ts`
- [x] Glisser-déposer natif (HTML5 drag-and-drop) : fiches et dossiers sont `draggable`, chaque
      ligne de dossier (+ la racine) est une zone de drop, réutilise `PATCH /api/folders`
      (identique à l'action "Déplacer vers..." de `/folders`) — pas de nouvelle route
- [x] **Bug trouvé et corrigé pendant la vérification** : déplacer un dossier dans lui-même (ou un
      de ses sous-dossiers) plantait l'API en 500 (non gérée) au lieu d'un 400 propre — `fs.rename`
      échoue avec `EINVAL` dans ce cas et cette erreur n'était traduite nulle part. Le garde-fou
      côté client (`TreeView`) empêche déjà ce cas via le drag-and-drop, mais `moveEntry()`
      (`lib/content/fs.ts`) le détecte maintenant aussi lui-même — l'API reste sûre même appelée
      directement, pas seulement protégée par l'UI.
- [x] Vérif (curl, simule le drop) : déplacement fiche → sous-dossier fonctionnel ; déplacement
      dossier → racine fonctionnel ; déplacement cyclique désormais rejeté en 400 avec message
      clair (au lieu de 500)
- [ ] Vérif visuelle réelle (glisser-déposer à la souris) : **non testée** — pas d'outil de
      contrôle navigateur dans ce sandbox ; à valider manuellement
