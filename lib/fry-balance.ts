import algosdk from 'algosdk';

const FRY_ASA_ID = 2485314946;
const USD_THRESHOLD = 50; // $50 USD minimum
const VESTIGE_API = 'https://api.vestigelabs.org/assets/price?asset_ids=2485314946';

// Algod endpoints with fallback
const ALGOD_PRIMARY = { url: 'http://192.168.9.2:4190', token: '' };   // ATLAS00
const ALGOD_FALLBACK = { url: 'https://mainnet-api.4160.nodely.dev', token: '' }; // Nodely

// Cache FRY price for 5 minutes
let priceCache = { price: 0, fetchedAt: 0 };

async function getFryPrice(): Promise<number> {
  if (Date.now() - priceCache.fetchedAt < 5 * 60 * 1000 && priceCache.price > 0) {
    return priceCache.price;
  }
  const response = await fetch(VESTIGE_API);
  if (!response.ok) {
    throw new Error(`Vestige API error: ${response.status}`);
  }
  const data = await response.json();
  const price = parseFloat(data[0].price);
  priceCache = { price, fetchedAt: Date.now() };
  return price;
}

/**
 * Get algod client with fallback logic.
 * Tries ATLAS00 first, falls back to Nodely on failure.
 */
async function getAlgodClient(): Promise<algosdk.Algodv2> {
  const primary = new algosdk.Algodv2(ALGOD_PRIMARY.token, ALGOD_PRIMARY.url, '');
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${ALGOD_PRIMARY.url}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      return primary;
    }
  } catch {
    // Fall through to fallback
  }
  
  console.log('ATLAS00 algod unavailable, falling back to Nodely');
  return new algosdk.Algodv2(ALGOD_FALLBACK.token, ALGOD_FALLBACK.url, '');
}

export interface FryBalanceResult {
  eligible: boolean;
  balance: number;
  required: number;
  priceUsd: number;
  thresholdUsd: number;
}

export async function checkFryBalance(address: string): Promise<FryBalanceResult> {
  const fryPrice = await getFryPrice();
  const requiredFry = Math.ceil((USD_THRESHOLD / fryPrice) * 1e6); // 6 decimals
  
  const algod = await getAlgodClient();
  const accountInfo = await algod.accountInformation(address).do();
  const fryAsset = accountInfo.assets?.find((a: any) => a['asset-id'] === FRY_ASA_ID);
  // Convert bigint to number (algosdk v3 returns bigint for amounts)
  const balance = Number(fryAsset?.amount ?? 0);
  
  return {
    eligible: balance >= requiredFry,
    balance: balance / 1e6,
    required: requiredFry / 1e6,
    priceUsd: fryPrice,
    thresholdUsd: USD_THRESHOLD
  };
}

export { FRY_ASA_ID, USD_THRESHOLD };
