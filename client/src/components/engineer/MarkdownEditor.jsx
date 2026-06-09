// client/src/components/engineer/MarkdownEditor.jsx
// Thin wrapper around @uiw/react-md-editor — the approved markdown editor for the
// Docs feature. This is the single sanctioned third-party UI widget (the spec
// names it explicitly); all surrounding chrome stays in Tailwind. Dark mode is
// driven by the `data-color-mode` attribute the editor reads from its container,
// kept in sync with the app theme (useTheme).
//
// The editor and a read-only preview are split into named exports so callers can
// render either an editing surface or a rendered view.

import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import rehypeSanitize from 'rehype-sanitize'; // Phase 1: strip unsafe HTML/JS from rendered markdown
import { useTheme } from '../../hooks/useTheme';

/**
 * Editing surface.
 * @param {{ value: string, onChange: (md: string) => void, height?: number }} props
 */
export function MarkdownEditor({ value, onChange, height = 420 }) {
  const { isDark } = useTheme();
  return (
    <div data-color-mode={isDark ? 'dark' : 'light'} className="rounded-lg overflow-hidden">
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? '')}
        height={height}
        preview="live"
        visibleDragbar={false}
        previewOptions={{ rehypePlugins: [[rehypeSanitize]] }}
      />
    </div>
  );
}

/**
 * Read-only rendered markdown.
 * @param {{ source: string }} props
 */
export function MarkdownPreview({ source }) {
  const { isDark } = useTheme();
  return (
    <div data-color-mode={isDark ? 'dark' : 'light'}>
      <MDEditor.Markdown
        source={source || '_No content yet._'}
        className="bg-transparent"
        rehypePlugins={[[rehypeSanitize]]}
      />
    </div>
  );
}
