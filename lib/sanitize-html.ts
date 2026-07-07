import DOMPurify from 'dompurify';

type DOMPurifyLike = {
  sanitize: (input: string) => string;
};

function fallbackSanitize(html: string) {
  // Fallback when running in SSR without a DOM-backed DOMPurify instance.
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=(["']).*?\1/gi, '')
    .replace(/\sjavascript:/gi, ' ');
}

// Bounded LRU memo. sanitizeHtml is a pure function of its input string but is
// called on every render for every vote card; rapid tab switching re-sanitized
// large (~15 KB) proposal descriptions across all cards and hung the renderer.
// Cache results per identical input, capped and oldest-evicted.
const CACHE_MAX = 64;
const cache = new Map<string, string>();

function memoized(input: string, compute: (value: string) => string): string {
  const hit = cache.get(input);
  if (hit !== undefined) {
    cache.delete(input);
    cache.set(input, hit); // refresh recency
    return hit;
  }
  const result = compute(input);
  cache.set(input, result);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return result;
}

export function sanitizeHtml(html: string) {
  const input = typeof html === 'string' ? html : '';
  return memoized(input, (value) => {
    const purifier = DOMPurify as unknown as DOMPurifyLike;

    if (purifier && typeof purifier.sanitize === 'function') {
      return purifier.sanitize(value);
    }

    return fallbackSanitize(value);
  });
}
