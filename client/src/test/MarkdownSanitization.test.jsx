// Phase 4: markdown sanitization regression test
// Renders XSS payloads through MarkdownPreview and asserts dangerous HTML is stripped.
// This confirms rehype-sanitize is active and any regression breaks the build.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownPreview } from '../components/engineer/MarkdownEditor';

// ── Mock useTheme so the component doesn't need a full provider ──────────────
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false, toggle: vi.fn() }),
}));

describe('MarkdownPreview — rehype-sanitize XSS protection', () => {
  it('strips <script> tags from rendered markdown', () => {
    const { container } = render(
      <MarkdownPreview source={'hello <script>alert("xss")</script> world'} />
    );
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).not.toContain('alert(');
    expect(container.textContent).toContain('hello');
  });

  it('strips onerror handler from <img> XSS payload', () => {
    const { container } = render(
      <MarkdownPreview source={'<img src=x onerror=alert(1)>'} />
    );
    // The onerror attribute must be absent
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.innerHTML).not.toContain('alert(1)');
  });

  it('strips javascript: href from a link', () => {
    const { container } = render(
      <MarkdownPreview source={'[click me](javascript:alert(1))'} />
    );
    expect(container.innerHTML).not.toContain('javascript:');
  });

  it('renders safe markdown content correctly', () => {
    const { container } = render(
      <MarkdownPreview source={'# Hello\n\nThis is **safe** content.'} />
    );
    expect(container.querySelector('h1')?.textContent).toBe('Hello');
    expect(container.querySelector('strong')?.textContent).toBe('safe');
  });

  it('renders the no-content fallback when source is empty', () => {
    const { container } = render(<MarkdownPreview source="" />);
    expect(container.textContent).toContain('No content yet');
  });
});
