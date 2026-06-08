// client/src/components/engineer/SnippetCard.jsx
// Grid card for a single code snippet: title, category + language badges, tags,
// and a clamped syntax-highlighted preview. A copy button copies the full code
// to the clipboard (toast on result). Clicking the preview opens the full modal.

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Card, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CodeBlock } from './CodeBlock';
import { LANGUAGE_LABEL } from './snippetConstants';
import { splitTags } from './ProjectRow';
import { useToast } from '../../hooks/useToast';

/**
 * @param {{
 *   snippet: Object,
 *   onOpen: (snippet: Object) => void,
 * }} props
 */
export function SnippetCard({ snippet, onOpen }) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const tags = splitTags(snippet.tags);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      addToast({ type: 'success', title: 'Copied to clipboard' });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      addToast({ type: 'error', title: 'Copy failed', message: 'Clipboard access was denied.' });
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardBody className="flex flex-col gap-3 flex-1">
        {/* Header: title + copy */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-gray-50 truncate">
            {snippet.title}
          </h3>
          <Button variant="ghost" size="sm" onClick={handleCopy} aria-label="Copy code">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="terracotta">{snippet.category}</Badge>
          <Badge variant="gray">{LANGUAGE_LABEL[snippet.language] ?? snippet.language}</Badge>
        </div>

        {/* Code preview — click to open full view */}
        <button
          type="button"
          onClick={() => onOpen(snippet)}
          className="block w-full text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400"
          aria-label={`Open snippet ${snippet.title}`}
        >
          <CodeBlock code={snippet.code} language={snippet.language} maxLines={8} />
        </button>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-auto pt-1">
            {tags.map(t => (
              <span key={t} className="text-[11px] text-stone-400 dark:text-gray-500">#{t}</span>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
