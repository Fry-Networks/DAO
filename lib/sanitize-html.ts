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

export function sanitizeHtml(html: string) {
  const input = typeof html === 'string' ? html : '';
  const purifier = DOMPurify as unknown as DOMPurifyLike;

  if (purifier && typeof purifier.sanitize === 'function') {
    return purifier.sanitize(input);
  }

  return fallbackSanitize(input);
}
