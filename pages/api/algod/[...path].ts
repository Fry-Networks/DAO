import type { NextApiRequest, NextApiResponse } from 'next';

const ALGOD_PRIMARY = 'http://192.168.9.2:4190';
const ALGOD_FALLBACK = 'https://mainnet-api.4160.nodely.dev';

// Allowlist of safe paths (read-only operations)
const ALLOWED_PATHS = [
  /^\/v2\/applications\//,
  /^\/v2\/accounts\//,
  /^\/v2\/transactions\/params$/,
  /^\/health$/,
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET requests allowed' });
  }

  const pathSegments = req.query.path;
  const path = '/' + (Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || '');
  const queryString = req.url?.includes('?') ? req.url.split('?')[1] : '';
  const fullPath = queryString ? `${path}?${queryString}` : path;

  // Validate against allowlist
  if (!ALLOWED_PATHS.some(pattern => pattern.test(path))) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  // Try primary (ATLAS00) with 3-second timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${ALGOD_PRIMARY}${fullPath}`, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback to Nodely
  try {
    const response = await fetch(`${ALGOD_FALLBACK}${fullPath}`);
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json(data);
    }
    return res.status(response.status).json({ error: 'Algod request failed' });
  } catch (err) {
    return res.status(502).json({ error: 'Both algod endpoints unavailable' });
  }
}
