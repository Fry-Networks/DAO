import algosdk from 'algosdk';
import { sha512_256 } from 'js-sha512';

// Contract constants
const GOVERNANCE_APP_ID = parseInt(process.env.NEXT_PUBLIC_GOVERNANCE_APP_ID || '3500693631');
const FRY_ASA_ID = 2485314946;
const VOTE_BOX_MBR = BigInt(104100);   // ~0.1 ALGO for vote creation
const STAKE_BOX_MBR = BigInt(61700);   // ~0.06 ALGO for voting
const VOTE_BOX_PREFIX = new Uint8Array([0x76]);  // "v"
const STAKE_BOX_PREFIX = new Uint8Array([0x73]); // "s"
const MAX_TEMP_CHECK_DURATION = 604800; // 7 days in seconds

/**
 * Concatenate Uint8Arrays (works with older TypeScript targets).
 */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Get algod client using local proxy.
 * The proxy handles ATLAS00 → Nodely fallback server-side.
 */
export function getAlgodClient(): algosdk.Algodv2 {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3012';
  return new algosdk.Algodv2('', baseUrl + '/api/algod', '');
}

/**
 * Generate vote ID from proposal name using sha512_256.
 * Returns 32-byte hash.
 */
export function makeVoteId(name: string): Uint8Array {
  const encoder = new TextEncoder();
  return new Uint8Array(sha512_256.array(encoder.encode(name)));
}

/**
 * Get ABI method selector (first 4 bytes of sha512_256 of method signature).
 */
export function getMethodSelector(methodSig: string): Uint8Array {
  const encoder = new TextEncoder();
  return new Uint8Array(sha512_256.array(encoder.encode(methodSig)).slice(0, 4));
}

/**
 * Compute stake box key: "s" + sha256(vote_id + sender)
 * Uses Web Crypto API for SHA-256 (browser-native).
 */
async function computeStakeBoxKey(voteId: Uint8Array, senderAddress: string): Promise<Uint8Array> {
  const senderBytes = algosdk.decodeAddress(senderAddress).publicKey;
  const combined = concatBytes(voteId, senderBytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined.buffer as ArrayBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  return concatBytes(STAKE_BOX_PREFIX, hashArray);
}

/**
 * Encode uint64 as big-endian bytes.
 */
function encodeUint64(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, BigInt(value), false);
  return bytes;
}

/**
 * Fetch fresh suggested params using native fetch with cache bypass.
 * algosdk's internal HTTP client does not set cache:'no-store', causing
 * the browser to serve stale params from disk cache. This function
 * bypasses the HTTP cache entirely on every call.
 */
export async function fetchFreshSuggestedParams(
  baseUrl: string
): Promise<algosdk.SuggestedParams> {
  const url = `${baseUrl}/api/algod/v2/transactions/params`;
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch suggested params: ${response.status}`);
  }
  const data = await response.json();
  // Map REST API field names to algosdk SuggestedParams
  // REST API returns: fee, min-fee, last-round, genesis-id, genesis-hash (base64)
  const lastRound = data['last-round'];
  // Decode base64 genesis hash to Uint8Array
  const genesisHashBase64 = data['genesis-hash'];
  const genesisHashBytes = Uint8Array.from(atob(genesisHashBase64), c => c.charCodeAt(0));
  
  return {
    fee: data['fee'] ?? 0,
    minFee: data['min-fee'] ?? 1000,
    firstValid: lastRound,
    lastValid: lastRound + 1000,
    genesisID: data['genesis-id'],
    genesisHash: genesisHashBytes,
    flatFee: false,
  };
}

/**
 * Wait for transaction confirmation using JSON endpoint (not msgpack).
 *
 * algosdk.waitForConfirmation() appends ?format=msgpack to the pending TX
 * endpoint. The proxy receives binary msgpack from algod, JSON-serializes a
 * raw Buffer, and returns {} — so algosdk never sees confirmed-round and
 * times out after 4 rounds.
 *
 * This implementation calls the same endpoint WITHOUT ?format=msgpack,
 * receiving JSON that the proxy handles correctly.
 */
export async function waitForConfirmationJson(
  txId: string,
  baseUrl: string,
  maxRounds: number = 8
): Promise<void> {
  // Get current round to start polling from
  const statusRes = await fetch(`${baseUrl}/api/algod/v2/status`, {
    cache: 'no-store',
  });
  if (!statusRes.ok) {
    throw new Error(`Failed to fetch algod status: ${statusRes.status}`);
  }
  const statusData = await statusRes.json();
  let currentRound: number = statusData['last-round'];

  for (let attempt = 0; attempt < maxRounds; attempt++) {
    // Check pending — NO ?format=msgpack so proxy gets JSON from algod
    const pendingRes = await fetch(
      `${baseUrl}/api/algod/v2/transactions/pending/${txId}`,
      { cache: 'no-store' }
    );
    if (pendingRes.ok) {
      const pendingData = await pendingRes.json();
      if (pendingData['confirmed-round'] && pendingData['confirmed-round'] > 0) {
        return; // confirmed
      }
      if (pendingData['pool-error'] && pendingData['pool-error'] !== '') {
        throw new Error(
          `Transaction rejected by pool: ${pendingData['pool-error']}`
        );
      }
    }

    // Wait for next block before checking again
    await fetch(
      `${baseUrl}/api/algod/v2/status/wait-for-block-after/${currentRound}`,
      { cache: 'no-store' }
    );
    currentRound += 1;
  }

  throw new Error(
    `Transaction ${txId} not confirmed after ${maxRounds} rounds`
  );
}

/**
 * Build request_temp_check transaction group.
 * Atomic group: [Payment, AppCall]
 */
export async function buildRequestTempCheck(
  algod: algosdk.Algodv2,
  sender: string,
  voteId: Uint8Array,
  endDate: number
): Promise<algosdk.Transaction[]> {
  const appAddress = algosdk.getApplicationAddress(GOVERNANCE_APP_ID);
  // Use native fetch with cache bypass to avoid stale browser cache
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:3012';
  const suggestedParams = await fetchFreshSuggestedParams(baseUrl);
  
  // Payment for vote box MBR
  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: appAddress,
    amount: VOTE_BOX_MBR,
    suggestedParams
  });
  
  // App call with method selector
  const methodSelector = getMethodSelector('request_temp_check(byte[32],uint64,pay)void');
  const endDateBytes = encodeUint64(endDate);
  const voteBoxName = concatBytes(VOTE_BOX_PREFIX, voteId);
  
  const appTxn = algosdk.makeApplicationCallTxnFromObject({
    sender,
    suggestedParams,
    appIndex: GOVERNANCE_APP_ID,
    appArgs: [methodSelector, voteId, endDateBytes],
    foreignAssets: [FRY_ASA_ID],
    boxes: [{ appIndex: GOVERNANCE_APP_ID, name: voteBoxName }],
    onComplete: algosdk.OnApplicationComplete.NoOpOC
  });
  
  algosdk.assignGroupID([payTxn, appTxn]);
  return [payTxn, appTxn];
}

/**
 * Build cast_temp_vote transaction group.
 * Atomic group: [Payment, AppCall]
 */
export async function buildCastTempVote(
  algod: algosdk.Algodv2,
  sender: string,
  voteId: Uint8Array,
  optionIndex: number
): Promise<algosdk.Transaction[]> {
  const appAddress = algosdk.getApplicationAddress(GOVERNANCE_APP_ID);
  // Use native fetch with cache bypass to avoid stale browser cache
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:3012';
  const suggestedParams = await fetchFreshSuggestedParams(baseUrl);
  
  // Compute stake box key: "s" + sha256(vote_id + sender)
  const stakeBoxKey = await computeStakeBoxKey(voteId, sender);
  const voteBoxName = concatBytes(VOTE_BOX_PREFIX, voteId);
  
  // Payment for stake box MBR
  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: appAddress,
    amount: STAKE_BOX_MBR,
    suggestedParams
  });
  
  // App call
  const methodSelector = getMethodSelector('cast_temp_vote(byte[32],uint8,pay)void');
  
  const appTxn = algosdk.makeApplicationCallTxnFromObject({
    sender,
    suggestedParams,
    appIndex: GOVERNANCE_APP_ID,
    appArgs: [methodSelector, voteId, new Uint8Array([optionIndex])],
    foreignAssets: [FRY_ASA_ID],
    boxes: [
      { appIndex: GOVERNANCE_APP_ID, name: voteBoxName },
      { appIndex: GOVERNANCE_APP_ID, name: stakeBoxKey }
    ],
    onComplete: algosdk.OnApplicationComplete.NoOpOC
  });
  
  algosdk.assignGroupID([payTxn, appTxn]);
  return [payTxn, appTxn];
}

/**
 * Query vote box from contract to get temp check status.
 * Returns null if vote doesn't exist.
 */
export async function getTempCheckStatus(
  algod: algosdk.Algodv2,
  voteId: Uint8Array
): Promise<{ endDate: number; yesVotes: number; noVotes: number; closed: boolean } | null> {
  try {
    const boxName = concatBytes(VOTE_BOX_PREFIX, voteId);
    const boxResponse = await algod.getApplicationBoxByName(GOVERNANCE_APP_ID, boxName).do();
    
    // Parse VoteRecord struct (220 bytes)
    // Offsets: vote_id(0-31), options_count(32), end_date(33-40), lock_duration(41-48),
    //          super_majority(49), vote_type(50), closed(51), created_by(52-83),
    //          created_at(84-91), total_tokens[8](92-155), total_voters[8](156-219)
    const data = boxResponse.value;
    const view = new DataView(data.buffer, data.byteOffset);
    
    const endDate = Number(view.getBigUint64(33, false));
    const closed = data[51] === 1;
    
    // total_tokens[0] = yes votes, total_tokens[1] = no votes (for temp check, tokens = voters)
    const yesVotes = Number(view.getBigUint64(92, false));
    const noVotes = Number(view.getBigUint64(100, false));
    
    return { endDate, yesVotes, noVotes, closed };
  } catch (error: any) {
    if (error.status === 404) {
      return null; // Box doesn't exist
    }
    throw error;
  }
}

/**
 * Check if user has already voted on a temp check.
 */
export async function hasUserVoted(
  algod: algosdk.Algodv2,
  voteId: Uint8Array,
  userAddress: string
): Promise<boolean> {
  try {
    const stakeBoxKey = await computeStakeBoxKey(voteId, userAddress);
    await algod.getApplicationBoxByName(GOVERNANCE_APP_ID, stakeBoxKey).do();
    return true; // Box exists, user has voted
  } catch (error: any) {
    if (error.status === 404) {
      return false; // Box doesn't exist, user hasn't voted
    }
    throw error;
  }
}


/**
 * Build cast_vote transaction group for official FIP/cFIP voting.
 * Atomic group: [Payment(MBR), AssetTransfer(FRY), AppCall(cast_vote)]
 */
export async function buildCastVote(
  sender: string,
  voteId: Uint8Array,
  optionIndex: number,
  fryAmount: bigint
): Promise<algosdk.Transaction[]> {
  const appAddress = algosdk.getApplicationAddress(GOVERNANCE_APP_ID);
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'http://127.0.0.1:3012';
  const suggestedParams = await fetchFreshSuggestedParams(baseUrl);

  const stakeBoxKey = await computeStakeBoxKey(voteId, sender);
  const voteBoxName = concatBytes(VOTE_BOX_PREFIX, voteId);

  // txn[0]: Payment for stake box MBR
  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: appAddress,
    amount: STAKE_BOX_MBR,
    suggestedParams
  });

  // txn[1]: AssetTransfer — FRY tokens to contract
  const assetTransferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender,
    receiver: appAddress,
    amount: fryAmount,
    assetIndex: FRY_ASA_ID,
    suggestedParams
  });

  // txn[2]: AppCall — cast_vote(byte[32],uint8,pay,axfer)void
  const methodSelector = getMethodSelector('cast_vote(byte[32],uint8,pay,axfer)void');
  const appTxn = algosdk.makeApplicationCallTxnFromObject({
    sender,
    suggestedParams,
    appIndex: GOVERNANCE_APP_ID,
    appArgs: [methodSelector, voteId, new Uint8Array([optionIndex])],
    foreignAssets: [FRY_ASA_ID],
    boxes: [
      { appIndex: GOVERNANCE_APP_ID, name: voteBoxName },
      { appIndex: GOVERNANCE_APP_ID, name: stakeBoxKey }
    ],
    onComplete: algosdk.OnApplicationComplete.NoOpOC
  });

  algosdk.assignGroupID([payTxn, assetTransferTxn, appTxn]);
  return [payTxn, assetTransferTxn, appTxn];
}

/**
 * Build withdraw transaction — self-service after lock expires.
 * Single AppCall, no group needed.
 */
export async function buildWithdraw(
  sender: string,
  voteId: Uint8Array
): Promise<algosdk.Transaction> {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'http://127.0.0.1:3012';
  const suggestedParams = await fetchFreshSuggestedParams(baseUrl);

  const stakeBoxKey = await computeStakeBoxKey(voteId, sender);
  const voteBoxName = concatBytes(VOTE_BOX_PREFIX, voteId);
  const methodSelector = getMethodSelector('withdraw(byte[32])void');

  return algosdk.makeApplicationCallTxnFromObject({
    sender,
    suggestedParams,
    appIndex: GOVERNANCE_APP_ID,
    appArgs: [methodSelector, voteId],
    foreignAssets: [FRY_ASA_ID],
    boxes: [
      { appIndex: GOVERNANCE_APP_ID, name: voteBoxName },
      { appIndex: GOVERNANCE_APP_ID, name: stakeBoxKey }
    ],
    onComplete: algosdk.OnApplicationComplete.NoOpOC
  });
}

/**
 * Read official vote tallies from the contract vote box.
 */
export async function getOfficialVoteStatus(
  voteId: Uint8Array
): Promise<{
  endDate: number;
  lockDuration: number;
  closed: boolean;
  optionsCount: number;
  totalTokens: bigint[];
  totalVoters: bigint[];
} | null> {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'http://127.0.0.1:3012';
  try {
    const boxName = concatBytes(VOTE_BOX_PREFIX, voteId);
    const b64Name = btoa(String.fromCharCode.apply(null, Array.from(boxName) as number[]));
    const res = await fetch(
      `${baseUrl}/api/algod/v2/applications/${GOVERNANCE_APP_ID}/box?name=b64:${encodeURIComponent(b64Name)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const data = Uint8Array.from(atob(json.value), c => c.charCodeAt(0));
    const view = new DataView(data.buffer, data.byteOffset);

    // VoteRecord layout (220 bytes):
    // vote_id(0-31), options_count(32), end_date(33-40), lock_duration(41-48),
    // super_majority(49), vote_type(50), closed(51), created_by(52-83),
    // created_at(84-91), total_tokens[8](92-155), total_voters[8](156-219)
    const optionsCount = data[32];
    const endDate = Number(view.getBigUint64(33, false));
    const lockDuration = Number(view.getBigUint64(41, false));
    const closed = data[51] === 1;
    const totalTokens: bigint[] = [];
    const totalVoters: bigint[] = [];
    for (let i = 0; i < 8; i++) {
      totalTokens.push(view.getBigUint64(92 + i * 8, false));
      totalVoters.push(view.getBigUint64(156 + i * 8, false));
    }
    return { endDate, lockDuration, closed, optionsCount, totalTokens, totalVoters };
  } catch {
    return null;
  }
}

/**
 * Check if a user has voted in an official vote.
 * Returns stake info if voted, null if not.
 */
export async function hasUserVotedOfficial(
  voteId: Uint8Array,
  userAddress: string
): Promise<{ optionIndex: number; tokenAmount: bigint; withdrawn: boolean } | null> {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'http://127.0.0.1:3012';
  try {
    const stakeBoxKey = await computeStakeBoxKey(voteId, userAddress);
    const b64Name = btoa(String.fromCharCode.apply(null, Array.from(stakeBoxKey) as number[]));
    const res = await fetch(
      `${baseUrl}/api/algod/v2/applications/${GOVERNANCE_APP_ID}/box?name=b64:${encodeURIComponent(b64Name)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const data = Uint8Array.from(atob(json.value), c => c.charCodeAt(0));
    const view = new DataView(data.buffer, data.byteOffset);
    // StakeRecord: voter(0-31), vote_id(32-63), option_index(64),
    //              token_amount(65-72), timestamp(73-80), withdrawn(81)
    const optionIndex = data[64];
    const tokenAmount = view.getBigUint64(65, false);
    const withdrawn = data[81] === 1;
    return { optionIndex, tokenAmount, withdrawn };
  } catch {
    return null;
  }
}

export {
  GOVERNANCE_APP_ID,
  FRY_ASA_ID,
  VOTE_BOX_MBR,
  STAKE_BOX_MBR,
  MAX_TEMP_CHECK_DURATION
};
