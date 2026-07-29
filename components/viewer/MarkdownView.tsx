export function MarkdownView({ html }: { html: string }) {
  return (
    <article
      className="prose prose-invert max-w-none prose-pre:bg-neutral-900"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
