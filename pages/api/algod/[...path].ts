import type { NextApiRequest, NextApiResponse } from 'next';
import http from 'http';

const ALGOD_PRIMARY = 'http://192.168.9.2:4190';
const ALGOD_FALLBACK = 'https://mainnet-api.4160.nodely.dev';

// Allowlist of safe paths
const ALLOWED_GET_PATHS = [
  /^\/v2\/applications\//,
  /^\/v2\/accounts\//,
  /^\/v2\/transactions\/params$/,
  /^\/v2\/status$/,
  /^\/health$/,
];

// Freshness check configuration
const STALE_THRESHOLD = 10;
const FRESHNESS_CHECK_INTERVAL = 30000;

let atlas00Healthy = true;
let lastFreshnessCheck = 0;

/**
 * Fetch /v2/status using http module (bypasses fetch's port blocking).
 */
function fetchStatus(url: string, token: string): Promise<{ lastRound: number } | null> {
  return new Promise((resolve) => {
    const urlObj = new URL(url + '/v2/status');
    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'GET',
      timeout: 3000,
      headers: token ? { 'X-Algo-API-Token': token } : {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            resolve({ lastRound: json['last-round'] || 0 });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function checkAtlasFreshness(): Promise<boolean> {
  const now = Date.now();
  if (now - lastFreshnessCheck < FRESHNESS_CHECK_INTERVAL) {
    return atlas00Healthy;
  }
  lastFreshnessCheck = now;

  const atlasStatus = await fetchStatus(ALGOD_PRIMARY, process.env.ALGOD_TOKEN || '');
  if (!atlasStatus) {
    console.log('[algod-proxy] ATLAS00 /v2/status fetch failed, routing to Nodely');
    atlas00Healthy = false;
    return false;
  }

  // Use fetch for Nodely (HTTPS, standard port)
  let nodelyRound = 0;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${ALGOD_FALLBACK}/v2/status`, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      const data = await response.json();
      nodelyRound = data['last-round'] || 0;
    } else {
      atlas00Healthy = true;
      return true;
    }
  } catch {
    atlas00Healthy = true;
    return true;
  }

  const roundsBehind = nodelyRound - atlasStatus.lastRound;
  if (roundsBehind > STALE_THRESHOLD) {
    console.log(`[algod-proxy] ATLAS00 is ${roundsBehind} rounds behind Nodely (${atlasStatus.lastRound} vs ${nodelyRound}), routing to Nodely`);
    atlas00Healthy = false;
    return false;
  }

  atlas00Healthy = true;
  return true;
}

export const config = {
  api: { bodyParser: false }
};

async function getRawBody(req: NextApiRequest): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    });
    req.on('error', reject);
  });
}

/**
 * Make HTTP request to ATLAS00 using http module (bypasses port blocking).
 */
function httpRequest(url: string, method: string, headers: Record<string, string>, body?: ArrayBuffer): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method,
      timeout: method === 'POST' ? 5000 : 3000,
      headers
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          resolve({ status: res.statusCode || 500, data });
        } catch {
          resolve({ status: res.statusCode || 500, data: {} });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    
    if (body) {
      req.write(Buffer.from(body));
    }
    req.end();
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pathSegments = req.query.path;
  const path = '/' + (Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || '');
  const queryString = req.url?.includes('?') ? req.url.split('?')[1] : '';
  const fullPath = queryString ? `${path}?${queryString}` : path;

  if (req.method === 'GET') {
    if (!ALLOWED_GET_PATHS.some(pattern => pattern.test(path))) {
      return res.status(403).json({ error: 'Path not allowed' });
    }

    const useAtlas = await checkAtlasFreshness();

    if (useAtlas) {
      try {
        const result = await httpRequest(
          `${ALGOD_PRIMARY}${fullPath}`,
          'GET',
          { 'X-Algo-API-Token': process.env.ALGOD_TOKEN || '' }
        );
        if (result.status === 200) {
          return res.status(200).json(result.data);
        }
      } catch {
        // Fall through to fallback
      }
    }

    try {
      const response = await fetch(`${ALGOD_FALLBACK}${fullPath}`);
      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }
      return res.status(response.status).json({ error: 'Algod request failed' });
    } catch {
      return res.status(502).json({ error: 'Both algod endpoints unavailable' });
    }
  }

  if (req.method === 'POST') {
    if (path !== '/v2/transactions') {
      return res.status(403).json({ error: 'POST only allowed for /v2/transactions' });
    }

    const body = await getRawBody(req);
    const useAtlas = await checkAtlasFreshness();

    if (useAtlas) {
      try {
        const result = await httpRequest(
          `${ALGOD_PRIMARY}${fullPath}`,
          'POST',
          {
            'Content-Type': 'application/x-binary',
            'X-Algo-API-Token': process.env.ALGOD_TOKEN || ''
          },
          body
        );
        return res.status(result.status).json(result.data);
      } catch {
        // Fall through to fallback
      }
    }

    try {
      const response = await fetch(`${ALGOD_FALLBACK}${fullPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-binary' },
        body
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch {
      return res.status(502).json({ error: 'Both algod endpoints unavailable' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
