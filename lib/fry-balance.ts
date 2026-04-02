import algosdk from 'algosdk';

const FRY_ASA_ID = 2485314946;
const USD_THRESHOLD = 50;
const VESTIGE_API = 'https://api.vestigelabs.org/assets/price?asset_ids=2485314946';

// Use Nodely for balance checks (algosdk uses fetch which blocks non-standard ports)
const ALGOD_URL = 'https://mainnet-api.4160.nodely.dev';

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

function getAlgodClient(): algosdk.Algodv2 {
  return new algosdk.Algodv2('', ALGOD_URL, '');
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
  const requiredFry = Math.ceil((USD_THRESHOLD / fryPrice) * 1e6);
  
  const algod = getAlgodClient();
  const accountInfo = await algod.accountInformation(address).do();
  
  const fryAsset = accountInfo.assets?.find((a: any) => {
    const id = a.assetId ?? a['asset-id'];
    return Number(id) === FRY_ASA_ID || BigInt(id) === BigInt(FRY_ASA_ID);
  });
  
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
