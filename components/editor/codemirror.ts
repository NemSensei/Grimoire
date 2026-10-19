import { EditorSelection, EditorState, type Extension, type Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  drawSelection,
  highlightActiveLine,
  keymap,
  placeholder,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  startCompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";

/* ---------- Coloration façon Obsidian (couleurs définies en variables CSS : suivent le thème) ---------- */

const highlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.65em", fontWeight: "750", color: "var(--cm-h1)" },
  { tag: t.heading2, fontSize: "1.38em", fontWeight: "700", color: "var(--cm-h2)" },
  { tag: t.heading3, fontSize: "1.18em", fontWeight: "650", color: "var(--cm-h3)" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "650", color: "var(--cm-h4)" },
  // Marqueurs de syntaxe (#, **, `, >, -, [ ]...) : présents mais en retrait, comme dans Obsidian.
  { tag: t.processingInstruction, color: "var(--fg-subtle)", fontWeight: "400" },
  { tag: t.strong, fontWeight: "700", color: "var(--cm-strong)" },
  { tag: t.emphasis, fontStyle: "italic", color: "var(--cm-em)" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--fg-subtle)" },
  { tag: t.link, color: "var(--accent)" },
  { tag: t.url, color: "var(--fg-subtle)", textDecoration: "underline" },
  { tag: t.monospace, fontFamily: "var(--font-mono)" },
  { tag: t.quote, color: "var(--fg-muted)" },
  { tag: t.contentSeparator, color: "var(--fg-subtle)", fontWeight: "700" },
  { tag: t.atom, color: "var(--accent)", fontWeight: "600" },
  { tag: t.labelName, color: "var(--cm-h3)" },
  // Langages des blocs de code (mêmes couleurs que le rendu des fiches)
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword], color: "var(--hl-keyword)" },
  { tag: [t.string, t.special(t.string), t.regexp, t.character], color: "var(--hl-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--hl-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--hl-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--hl-title)" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--hl-built)" },
  { tag: [t.propertyName, t.attributeName], color: "var(--hl-attr)" },
  { tag: [t.meta, t.tagName], color: "var(--hl-meta)" },
]);

const editorTheme = EditorView.theme({
  "&": { color: "var(--fg)", backgroundColor: "transparent", fontSize: "16px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-sans)", lineHeight: "1.75", overflow: "visible" },
  ".cm-content": { padding: "28px 0 40vh", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0 2px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--accent) 5%, transparent)" },
  ".cm-placeholder": { color: "var(--fg-subtle)", fontStyle: "italic" },
  ".cm-selectionMatch": { backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)" },
  ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, #f59e0b 30%, transparent)" },
  ".cm-tooltip": {
    border: "1px solid var(--border)",
    backgroundColor: "var(--bg)",
    borderRadius: "10px",
    boxShadow: "0 12px 32px rgb(0 0 0 / 0.18)",
    overflow: "hidden",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-sans)", maxHeight: "18em", padding: "4px" },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": { padding: "6px 10px", borderRadius: "6px", lineHeight: "1.4" },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent-soft)",
    color: "var(--accent)",
  },
  ".cm-completionDetail": { marginLeft: "0.75em", color: "var(--fg-subtle)", fontStyle: "normal", fontSize: "0.85em" },
  ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "700" },
  ".cm-completionIcon": { display: "none" },
  ".cm-panels": { backgroundColor: "var(--bg-subtle)", color: "var(--fg)", borderColor: "var(--border)" },
  ".cm-panels-top": { borderBottom: "1px solid var(--border)" },
  ".cm-panel.cm-search": { padding: "8px 12px", fontFamily: "var(--font-sans)" },
  ".cm-panel.cm-search input, .cm-panel.cm-search button": {
    border: "1px solid var(--border)",
    borderRadius: "6px",
    backgroundColor: "var(--bg)",
    color: "var(--fg)",
    backgroundImage: "none",
  },
});

/* ---------- Décorations de lignes (blocs de code, citations, callouts, titres) ---------- */

const CALLOUT_RE = /^\s*>\s*\[!(note|tip|important|warning|caution)\]/i;

function blockDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const doc = view.state.doc;

  const decorateLines = (from: number, to: number, className: string, edges = false) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let n = first; n <= last; n++) {
      const classes = [className];
      if (edges && n === first) classes.push(`${className}-first`);
      if (edges && n === last) classes.push(`${className}-last`);
      ranges.push(Decoration.line({ class: classes.join(" ") }).range(doc.line(n).from));
    }
  };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name === "FencedCode" || node.name === "CodeBlock") {
          decorateLines(node.from, node.to, "cm-md-codeblock", true);
          return false;
        }
        if (node.name === "Blockquote") {
          const kind = doc.lineAt(node.from).text.match(CALLOUT_RE)?.[1]?.toLowerCase();
          decorateLines(node.from, node.to, kind ? `cm-md-callout cm-md-callout-${kind}` : "cm-md-quote");
          return undefined;
        }
        if (node.name === "InlineCode") {
          ranges.push(Decoration.mark({ class: "cm-md-inline-code" }).range(node.from, node.to));
          return false;
        }
        const heading = /^ATXHeading(\d)$/.exec(node.name);
        if (heading) {
          ranges.push(Decoration.line({ class: `cm-md-heading cm-md-h${heading[1]}` }).range(doc.lineAt(node.from).from));
        }
        return undefined;
      },
    });
  }
  return Decoration.set(ranges, true);
}

const blockDecorationsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = blockDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
        this.decorations = blockDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/** `[[liens internes]]` surlignés en couleur d'accent. */
const wikiLinkMatcher = new MatchDecorator({
  regexp: /\[\[[^[\]\n]+\]\]/g,
  decoration: Decoration.mark({ class: "cm-md-wikilink" }),
});

const wikiLinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = wikiLinkMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = wikiLinkMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

/* ---------- Autocomplétion des liens [[…]] ---------- */

export interface LinkSuggestion {
  title: string;
  /** Texte inséré entre les crochets (nom de fichier, ou chemin si ambigu). */
  target: string;
  folder: string;
}

function wikiLinkCompletion(suggestions: LinkSuggestion[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\[\[[^[\]|#\n]*$/);
    if (!match) return null;
    return {
      from: match.from + 2,
      validFor: /^[^[\]|#\n]*$/,
      options: suggestions.map((s) => ({
        label: s.title,
        detail: s.folder || "racine",
        apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
          // closeBrackets a souvent déjà inséré les « ]] » fermants.
          const hasClosing = view.state.sliceDoc(to, to + 2) === "]]";
          view.dispatch({
            changes: { from, to, insert: hasClosing ? s.target : `${s.target}]]` },
            selection: { anchor: from + s.target.length + 2 },
          });
        },
      })),
    };
  };
}

/* ---------- Commandes de mise en forme (barre d'outils + raccourcis) ---------- */

export function toggleWrap(view: EditorView, marker: string, fallback = "texte"): boolean {
  const { state } = view;
  const tr = state.changeByRange((range) => {
    const before = state.sliceDoc(range.from - marker.length, range.from);
    const after = state.sliceDoc(range.to, range.to + marker.length);
    if (before === marker && after === marker) {
      return {
        changes: [
          { from: range.from - marker.length, to: range.from },
          { from: range.to, to: range.to + marker.length },
        ],
        range: EditorSelection.range(range.from - marker.length, range.to - marker.length),
      };
    }
    const inner = state.sliceDoc(range.from, range.to) || fallback;
    return {
      changes: { from: range.from, to: range.to, insert: `${marker}${inner}${marker}` },
      range: EditorSelection.range(range.from + marker.length, range.from + marker.length + inner.length),
    };
  });
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input" }));
  view.focus();
  return true;
}

/** Ajoute (ou retire s'il est déjà là) un préfixe sur chaque ligne sélectionnée. */
export function toggleLinePrefix(view: EditorView, prefix: string, pattern: RegExp): boolean {
  const { state } = view;
  const changes: { from: number; to: number; insert: string }[] = [];
  const seen = new Set<number>();
  for (const range of state.selection.ranges) {
    for (let pos = range.from; pos <= range.to; ) {
      const line = state.doc.lineAt(pos);
      if (!seen.has(line.number)) {
        seen.add(line.number);
        const existing = line.text.match(pattern)?.[0];
        if (existing === prefix) changes.push({ from: line.from, to: line.from + existing.length, insert: "" });
        else changes.push({ from: line.from, to: line.from + (existing?.length ?? 0), insert: prefix });
      }
      pos = line.to + 1;
    }
  }
  view.dispatch({ changes, scrollIntoView: true, userEvent: "input" });
  view.focus();
  return true;
}

export function setHeading(view: EditorView, level: number): boolean {
  return toggleLinePrefix(view, `${"#".repeat(level)} `, /^#{1,6}\s+/);
}

/** Insère un bloc sur sa propre ligne, curseur placé à `cursorOffset` dans le bloc inséré. */
export function insertBlock(view: EditorView, block: string, cursorOffset = block.length): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;
  const line = state.doc.lineAt(from);
  const needsBreak = line.text.trim() !== "" ? "\n\n" : "";
  const insert = `${needsBreak}${block}`;
  view.dispatch({
    changes: { from: needsBreak ? line.to : from, to: needsBreak ? line.to : to, insert },
    selection: { anchor: (needsBreak ? line.to : from) + needsBreak.length + cursorOffset },
    scrollIntoView: true,
    userEvent: "input",
  });
  view.focus();
  return true;
}

/** `[[sélection]]`, ou `[[]]` avec la liste des fiches ouverte si rien n'est sélectionné. */
export function insertWikiLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `[[${selected}]]` },
    selection: selected ? { anchor: from + selected.length + 4 } : { anchor: from + 2 },
    userEvent: "input",
  });
  view.focus();
  if (!selected) startCompletion(view);
  return true;
}

export function insertText(view: EditorView, text: string, at?: number): void {
  const pos = Math.min(at ?? view.state.selection.main.head, view.state.doc.length);
  view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length }, userEvent: "input" });
}

const formattingKeymap = keymap.of([
  { key: "Mod-b", run: (v) => toggleWrap(v, "**") },
  { key: "Mod-i", run: (v) => toggleWrap(v, "*") },
  { key: "Mod-`", run: (v) => toggleWrap(v, "`", "code") },
  { key: "Mod-Shift-x", run: (v) => toggleWrap(v, "~~") },
  { key: "Mod-1", run: (v) => setHeading(v, 1) },
  { key: "Mod-2", run: (v) => setHeading(v, 2) },
  { key: "Mod-3", run: (v) => setHeading(v, 3) },
]);

/* ---------- Assemblage ---------- */

function imageFiles(list: DataTransfer | null): File[] {
  return Array.from(list?.files ?? []).filter((f) => f.type.startsWith("image/"));
}

export interface EditorCallbacks {
  onChange: (value: string) => void;
  onImages: (files: File[], position: number) => void;
}

export function createEditorState(doc: string, suggestions: LinkSuggestion[], callbacks: EditorCallbacks): EditorState {
  const extensions: Extension[] = [
    history(),
    drawSelection(),
    highlightActiveLine(),
    EditorView.lineWrapping,
    EditorState.allowMultipleSelections.of(true),
    markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: false }),
    syntaxHighlighting(highlightStyle),
    blockDecorationsPlugin,
    wikiLinkPlugin,
    closeBrackets(),
    autocompletion({ override: [wikiLinkCompletion(suggestions)], icons: false }),
    search({ top: true }),
    highlightSelectionMatches(),
    placeholder("Commencez à écrire… (tapez [[ pour lier une autre fiche)"),
    formattingKeymap,
    keymap.of([
      ...markdownKeymap, // Entrée continue les listes / citations, comme dans Obsidian
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab,
      ...defaultKeymap,
    ]),
    editorTheme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) callbacks.onChange(update.state.doc.toString());
    }),
    EditorView.domEventHandlers({
      paste(event, view) {
        const files = imageFiles(event.clipboardData);
        if (files.length === 0) return false; // collage texte normal
        event.preventDefault();
        callbacks.onImages(files, view.state.selection.main.head);
        return true;
      },
      drop(event, view) {
        const files = imageFiles(event.dataTransfer);
        if (files.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
        callbacks.onImages(files, pos);
        return true;
      },
    }),
  ];
  return EditorState.create({ doc, extensions });
}
