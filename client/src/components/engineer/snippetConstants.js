// client/src/components/engineer/snippetConstants.js
// Shared option lists for snippet category and language selects. `category` is
// extensible (free text is allowed server-side); this is the suggested set the
// UI offers. Language values map to Prism language ids used by prism-react-renderer.

/** Suggested snippet categories (extensible — the API does not constrain these). */
export const SNIPPET_CATEGORIES = [
  'Sensor Driver',
  'Communication',
  'Motor Control',
  'Power Management',
  'Filtering / DSP',
  'RTOS',
  'Networking',
  'Vision',
  'Utility',
  'Config',
  'Other',
];

/** Supported languages → { value (Prism id), label }. */
export const SNIPPET_LANGUAGES = [
  { value: 'cpp',        label: 'C++' },
  { value: 'c',          label: 'C' },
  { value: 'python',     label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'bash',       label: 'Shell / Bash' },
  { value: 'yaml',       label: 'YAML' },
  { value: 'json',       label: 'JSON' },
  { value: 'ini',        label: 'INI / Config' },
  { value: 'markup',     label: 'XML / HTML' },
];

/** @type {Record<string, string>} */
export const LANGUAGE_LABEL = SNIPPET_LANGUAGES.reduce((acc, l) => {
  acc[l.value] = l.label;
  return acc;
}, {});
