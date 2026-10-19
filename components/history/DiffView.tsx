interface DiffLine {
  kind: "add" | "del" | "ctx" | "hunk" | "meta";
  text: string;
  oldNo?: number;
  newNo?: number;
}

/** Transforme un patch unifié (`git show`) en lignes numérotées, sans les en-têtes techniques. */
function parsePatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  let inHunk = false;

  for (const raw of patch.split("\n")) {
    const hunk = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
    if (hunk) {
      inHunk = true;
      oldNo = Number(hunk[1]);
      newNo = Number(hunk[2]);
      lines.push({ kind: "hunk", text: hunk[3].trim() || `Lignes ${newNo} et suivantes` });
      continue;
    }
    if (!inHunk) {
      if (raw.startsWith("rename from ")) lines.push({ kind: "meta", text: `Renommée depuis ${raw.slice(12)}` });
      continue;
    }
    if (raw.startsWith("diff --git")) {
      inHunk = false;
      continue;
    }
    if (raw.startsWith("+")) lines.push({ kind: "add", text: raw.slice(1), newNo: newNo++ });
    else if (raw.startsWith("-")) lines.push({ kind: "del", text: raw.slice(1), oldNo: oldNo++ });
    else if (raw.startsWith(" ")) lines.push({ kind: "ctx", text: raw.slice(1), oldNo: oldNo++, newNo: newNo++ });
  }
  return lines;
}

const ROW: Record<DiffLine["kind"], string> = {
  add: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  del: "bg-red-500/10 text-red-800 dark:text-red-300",
  ctx: "text-fg-muted",
  hunk: "bg-accent-soft/60 text-accent",
  meta: "text-fg-subtle italic",
};

const SIGN: Record<DiffLine["kind"], string> = { add: "+", del: "−", ctx: " ", hunk: "", meta: "" };

export function DiffView({ patch }: { patch: string }) {
  const lines = parsePatch(patch);
  if (lines.length === 0) {
    return <p className="text-sm text-fg-subtle">Aucune différence de contenu dans cette version.</p>;
  }

  const added = lines.filter((l) => l.kind === "add").length;
  const removed = lines.filter((l) => l.kind === "del").length;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex gap-4 border-b border-border bg-bg-subtle px-4 py-2 text-xs font-medium">
        <span className="text-emerald-700 dark:text-emerald-400">+{added} ajoutée{added > 1 ? "s" : ""}</span>
        <span className="text-red-700 dark:text-red-400">−{removed} supprimée{removed > 1 ? "s" : ""}</span>
      </div>
      <div className="thin-scroll overflow-x-auto font-mono text-[0.8rem] leading-6">
        {lines.map((line, i) => (
          <div key={i} className={`flex min-w-fit ${ROW[line.kind]}`}>
            <span className="w-10 shrink-0 select-none pr-2 text-right text-fg-subtle/70">{line.oldNo ?? ""}</span>
            <span className="w-10 shrink-0 select-none pr-2 text-right text-fg-subtle/70">{line.newNo ?? ""}</span>
            <span className="w-5 shrink-0 select-none text-center">{SIGN[line.kind]}</span>
            <span className="whitespace-pre-wrap break-all pr-4">{line.text || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
