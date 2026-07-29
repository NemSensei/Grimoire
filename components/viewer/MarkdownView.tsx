export function MarkdownView({ html }: { html: string }) {
  return (
    <article
      className="prose prose-invert max-w-none min-w-0 break-words prose-pre:bg-neutral-900 prose-pre:whitespace-pre-wrap prose-pre:break-words"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
