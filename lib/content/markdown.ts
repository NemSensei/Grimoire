import { unified } from "unified";
import { visit, SKIP } from "unist-util-visit";
import type { Root, Element, ElementContent } from "hast";
import type { Root as MdRoot, PhrasingContent } from "mdast";
import type { VFile } from "vfile";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { WIKILINK_RE, headingSlug, type LinkIndex } from "./links";
import { ficheHref } from "./labels";

type AttributeDefs = NonNullable<typeof defaultSchema.attributes>[string];

/**
 * Autorise toute classe sur l'élément. Les entrées `["className", ...valeurs]` du schéma par défaut
 * sont retirées : elles l'emporteraient et videraient nos classes. Sans plugin rehype-raw, une
 * fiche ne peut pas écrire de HTML : seules nos propres extensions posent des classes.
 */
function allowClassName(defs: AttributeDefs | undefined): AttributeDefs {
  return [...(defs ?? []).filter((d) => !(Array.isArray(d) && d[0] === "className")), "className"];
}

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: allowClassName(defaultSchema.attributes?.code),
    span: allowClassName(defaultSchema.attributes?.span),
    div: allowClassName(defaultSchema.attributes?.div),
    a: allowClassName(defaultSchema.attributes?.a), // liens [[…]]
  },
};

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface RenderedFiche {
  html: string;
  toc: TocEntry[];
}

function textOf(node: Element | ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

function el(tagName: string, className: string[], children: ElementContent[], extra: Element["properties"] = {}): Element {
  return { type: "element", tagName, properties: { className, ...extra }, children };
}

/**
 * Enveloppe chaque <table> dans un <div class="table-wrapper"> pour cantonner le scroll
 * horizontal des tableaux larges à eux-mêmes, plutôt que de laisser toute la page déborder
 * (les colonnes d'un tableau ne peuvent pas raisonnablement être forcées à passer à la ligne).
 */
function rehypeWrapTables() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "table" || !parent || typeof index !== "number") return undefined;
      parent.children.splice(index, 1, el("div", ["table-wrapper"], [node]));
      return SKIP;
    });
  };
}

/**
 * Liens `[[…]]` entre fiches. L'index de résolution arrive par `file.data.linkIndex` pour garder
 * un seul processeur figé. Les nœuds de code ne sont pas des nœuds `text` : leur contenu est ignoré.
 */
function remarkWikiLinks() {
  return (tree: MdRoot, file: VFile) => {
    const index = file.data.linkIndex as LinkIndex | undefined;
    if (!index) return;

    visit(tree, "text", (node, position, parent) => {
      if (!parent || typeof position !== "number" || parent.type === "link" || parent.type === "linkReference") {
        return undefined;
      }
      const value = node.value;
      const pieces: PhrasingContent[] = [];
      let last = 0;

      for (const match of value.matchAll(WIKILINK_RE)) {
        const [whole, target, section, label] = match;
        if (match.index > last) pieces.push({ type: "text", value: value.slice(last, match.index) });
        const fiche = index.resolve(target);
        const text = label?.trim() || (section ? `${(fiche?.title ?? target).trim()} › ${section.trim()}` : fiche?.title ?? target.trim());
        pieces.push({
          type: "link",
          url: fiche
            ? `${ficheHref(fiche.path)}${section ? `#user-content-${headingSlug(section)}` : ""}`
            : `/new?title=${encodeURIComponent(target.trim())}`,
          title: fiche ? null : "Fiche inexistante — cliquer pour la créer",
          children: [{ type: "text", value: text }],
          data: { hProperties: { className: fiche ? ["wikilink"] : ["wikilink", "wikilink-missing"] } },
        });
        last = match.index + whole.length;
      }

      if (pieces.length === 0) return undefined;
      if (last < value.length) pieces.push({ type: "text", value: value.slice(last) });
      parent.children.splice(position, 1, ...pieces);
      return position + pieces.length;
    });
  };
}

const CALLOUT_TITLES: Record<string, string> = {
  note: "Note",
  tip: "Astuce",
  important: "Important",
  warning: "Attention",
  caution: "Danger",
};

/**
 * Callouts façon GitHub/GitBook : un blockquote commençant par `[!NOTE]` (TIP, IMPORTANT,
 * WARNING, CAUTION) devient un encadré coloré. Tourne avant la sanitization : seuls des
 * div/p/className (déjà autorisés par le schéma) sont produits.
 */
function rehypeCallouts() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "blockquote") return;
      const firstP = node.children.find((c): c is Element => c.type === "element");
      if (!firstP || firstP.tagName !== "p") return;
      const firstText = firstP.children[0];
      if (!firstText || firstText.type !== "text") return;

      const match = firstText.value.match(/^\s*\[!(note|tip|important|warning|caution)\][ \t]*\n?/i);
      if (!match) return;

      const kind = match[1].toLowerCase();
      firstText.value = firstText.value.slice(match[0].length);
      if (firstP.children.length === 1 && firstText.value.trim() === "") {
        node.children.splice(node.children.indexOf(firstP), 1);
      }

      node.tagName = "div";
      node.properties = { className: ["callout", `callout-${kind}`] };
      node.children = [
        // div (et non p) : le schéma de sanitization n'autorise className que sur div/span/code.
        el("div", ["callout-title"], [{ type: "text", value: CALLOUT_TITLES[kind] }]),
        ...node.children,
      ];
    });
  };
}

/**
 * Post-sanitization (le HTML ajouté ici est généré par nous, jamais issu de la fiche) :
 * - collecte le sommaire (h2/h3) avec les id définitifs (préfixés `user-content-` par rehype-sanitize) ;
 * - ajoute une ancre cliquable à chaque titre ;
 * - enveloppe les blocs de code avec un en-tête (langage + bouton copier).
 */
function rehypeDocEnhance() {
  return (tree: Root, file: VFile) => {
    const toc: TocEntry[] = [];

    visit(tree, "element", (node: Element, index, parent) => {
      const heading = /^h([1-4])$/.exec(node.tagName);
      if (heading && typeof node.properties.id === "string") {
        const id = node.properties.id;
        const depth = Number(heading[1]);
        if (depth === 2 || depth === 3) toc.push({ id, text: textOf(node).trim(), depth });
        node.children.push(
          el("a", ["heading-anchor"], [{ type: "text", value: "#" }], { href: `#${id}`, ariaHidden: "true", tabIndex: -1 }),
        );
        return SKIP;
      }

      if (node.tagName === "pre" && parent && typeof index === "number") {
        const code = node.children.find((c): c is Element => c.type === "element" && c.tagName === "code");
        const classes = (code?.properties.className as string[] | undefined) ?? [];
        const lang = classes.find((c) => c.startsWith("language-"))?.slice("language-".length) ?? "";
        const header = el("div", ["code-header"], [
          el("span", ["code-lang"], [{ type: "text", value: lang || "texte" }]),
          el("button", ["code-copy"], [{ type: "text", value: "Copier" }], { type: "button" }),
        ]);
        parent.children.splice(index, 1, el("div", ["code-block"], [header, node]));
        return SKIP;
      }
      return undefined;
    });

    file.data.toc = toc;
  };
}

const HINT_KINDS: Record<string, string> = {
  info: "NOTE",
  success: "TIP",
  warning: "WARNING",
  danger: "CAUTION",
};

/** Convertit les blocs `{% hint style="..." %}` des exports GitBook en callouts `> [!KIND]`. */
function convertGitbookHints(markdown: string): string {
  return markdown.replace(
    /\{%\s*hint\s+style="(\w+)"\s*%\}\r?\n?([\s\S]*?)\{%\s*endhint\s*%\}/g,
    (_all, style: string, body: string) => {
      const kind = HINT_KINDS[style] ?? "NOTE";
      const quoted = body.replace(/\s+$/, "").split(/\r?\n/).map((line) => (line ? `> ${line}` : ">"));
      return [`> [!${kind}]`, ...quoted].join("\n");
    },
  );
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkWikiLinks)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeHighlight)
  .use(rehypeWrapTables)
  .use(rehypeCallouts)
  .use(rehypeSanitize, schema)
  .use(rehypeDocEnhance)
  .use(rehypeStringify);

/**
 * Cache des rendus (coloration syntaxique comprise, le poste le plus coûteux) indexé par une clé
 * fournie par l'appelant. Elle doit inclure la version de l'arborescence : la résolution des
 * liens `[[…]]` change quand une fiche est créée, renommée ou supprimée.
 * Sur globalThis pour survivre aux rechargements de module et être partagé entre bundles.
 */
const RENDER_CACHE_MAX = 300;
const holder = globalThis as { __grimoireRenderCache?: Map<string, RenderedFiche> };
const renderCache = (holder.__grimoireRenderCache ??= new Map());

export interface RenderOptions {
  /** Clé de cache (chemin + mtime + version de l'arborescence) ; sans clé, pas de cache. */
  cacheKey?: string;
  /** Index de résolution des liens `[[…]]` ; sans index, ils restent du texte brut. */
  links?: LinkIndex;
}

export async function renderFiche(markdown: string, options: RenderOptions = {}): Promise<RenderedFiche> {
  const { cacheKey, links } = options;
  if (cacheKey) {
    const hit = renderCache.get(cacheKey);
    if (hit) return hit;
  }

  const file = await processor.process({ value: convertGitbookHints(markdown), data: { linkIndex: links } });
  const rendered: RenderedFiche = { html: String(file), toc: (file.data.toc as TocEntry[] | undefined) ?? [] };

  if (cacheKey) {
    if (renderCache.size >= RENDER_CACHE_MAX) {
      renderCache.delete(renderCache.keys().next().value!);
    }
    renderCache.set(cacheKey, rendered);
  }
  return rendered;
}
