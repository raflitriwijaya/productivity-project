// client/src/lib/generateCitation.js
// Formats a research entry as a citation string in one of three styles.
// These are pragmatic, best-effort renderings from the limited fields an entry
// has (title, source, tags, created_at) — not a full bibliographic engine.
// `source` is treated as the author/publication string (or a URL); when it's a
// URL it's appended as a "Retrieved from" trailer rather than used as an author.

/** Is the source string a web URL? */
function isUrl(source) {
  return !!source && (source.startsWith('http://') || source.startsWith('https://'));
}

/** Year (e.g. "2026") from an ISO timestamp. */
function year(createdAt) {
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? 'n.d.' : String(d.getFullYear());
}

/** Full date "2 June 2026" for MLA's access date. */
function longDate(createdAt) {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Ensure a string ends with a period (avoids doubling). */
function dot(s) {
  const t = (s ?? '').trim();
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * Generate a citation string for an entry.
 * @param {{ title?: string, source?: string, tags?: string, created_at?: string }} entry
 * @param {'apa'|'mla'|'ieee'} [style='apa']
 * @returns {string}
 */
export function generateCitation(entry, style = 'apa') {
  const title  = (entry?.title ?? 'Untitled').trim();
  const source = (entry?.source ?? '').trim();
  const y      = year(entry?.created_at);
  const url    = isUrl(source) ? source : '';
  // Author/publication = source when it isn't a bare URL.
  const author = source && !url ? source : '';

  switch (style) {
    case 'mla': {
      // Author. "Title." Publication, Year, URL. Accessed Day Month Year.
      const parts = [];
      if (author) parts.push(dot(author));
      parts.push(`"${dot(title)}"`);
      parts.push(y === 'n.d.' ? '' : `${y}.`);
      if (url) parts.push(`${url}.`);
      const accessed = longDate(entry?.created_at);
      if (accessed) parts.push(`Accessed ${accessed}.`);
      return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }

    case 'ieee': {
      // Author, "Title," Year. [Online]. Available: URL
      const segs = [];
      if (author) segs.push(`${author.replace(/\.$/, '')},`);
      segs.push(`"${title.replace(/\.$/, '')},"`);
      segs.push(`${y}.`);
      if (url) segs.push(`[Online]. Available: ${url}`);
      return segs.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }

    case 'apa':
    default: {
      // Author. (Year). Title. Retrieved from URL
      const parts = [];
      if (author) parts.push(dot(author));
      parts.push(`(${y}).`);
      parts.push(dot(title));
      if (url) parts.push(`Retrieved from ${url}`);
      return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }
  }
}

/** Display labels for the supported styles (for the citation dropdown). */
export const CITATION_STYLES = [
  { value: 'apa',  label: 'APA' },
  { value: 'mla',  label: 'MLA' },
  { value: 'ieee', label: 'IEEE' },
];
