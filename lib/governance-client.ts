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
  return new algosdk.Algodv2('', '/api/algod', '');
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
  const suggestedParams = await algod.getTransactionParams().do();
  
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
  const suggestedParams = await algod.getTransactionParams().do();
  
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

export {
  GOVERNANCE_APP_ID,
  FRY_ASA_ID,
  VOTE_BOX_MBR,
  STAKE_BOX_MBR,
  MAX_TEMP_CHECK_DURATION
};
