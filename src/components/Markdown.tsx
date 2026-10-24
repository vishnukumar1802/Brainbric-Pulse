import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renders agent-written Markdown safely: raw HTML in it is shown as text, never run. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-pulse">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
