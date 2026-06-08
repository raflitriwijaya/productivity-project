// client/src/components/engineer/CodeBlock.jsx
// Syntax-highlighted code block built on prism-react-renderer (the approved
// dependency for snippet highlighting). Container styling is Tailwind with full
// dark: variants; only Prism's per-token colors come from the theme's inline
// styles — there is no Tailwind equivalent for arbitrary token coloring, so this
// is the same justified style exception as the progress-bar width (§10).
//
// The Prism theme follows the app theme: vsLight in light mode, vsDark in dark.

import { Highlight, themes } from 'prism-react-renderer';
import { useTheme } from '../../hooks/useTheme';

/**
 * @param {{
 *   code: string,
 *   language?: string,    // Prism language id (cpp, python, …)
 *   maxLines?: number,    // if set, clamp height and fade — used for previews
 *   className?: string,
 * }} props
 * @returns {JSX.Element}
 */
export function CodeBlock({ code, language = 'cpp', maxLines, className = '' }) {
  const { isDark } = useTheme();
  const theme = isDark ? themes.vsDark : themes.vsLight;

  // For previews we clamp to a fixed height and hide overflow; full views scroll.
  const clamp = maxLines
    ? { maxHeight: `${maxLines * 1.6}em`, overflow: 'hidden' }
    : { overflow: 'auto' };

  return (
    <Highlight code={code.trimEnd()} language={language} theme={theme}>
      {({ className: prismClass, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`text-[13px] font-mono leading-relaxed rounded-lg p-4
            bg-stone-100 dark:bg-gray-900 border border-stone-200 dark:border-gray-700
            ${maxLines ? '' : 'max-h-[60vh] overflow-auto'} ${prismClass} ${className}`}
          // Prism token theme colors + (for previews) the height clamp. No layout
          // values live here — spacing/typography are Tailwind classes above.
          style={{ ...style, ...clamp, background: 'transparent' }}
        >
          {tokens.map((line, i) => {
            const lineProps = getLineProps({ line });
            return (
              <div key={i} {...lineProps}>
                {line.map((token, key) => {
                  const tokenProps = getTokenProps({ token });
                  return <span key={key} {...tokenProps} />;
                })}
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}
