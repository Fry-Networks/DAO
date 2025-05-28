import { NextApiRequest, NextApiResponse } from 'next';
import { Stake } from '../../lib/stake-schema';
import clientPromise from '../../lib/mongoclient';
import algosdk, { Indexer } from 'algosdk';
import { flightRouterStateSchema } from 'next/dist/server/app-render/types';

const calculateTimeLeft = (stake: Stake) => {
  const testMode = process.env.NEXT_PUBLIC_TEST === 'true' ? true : false;
  const now = new Date(Date.now());
  const voteEndDate = new Date(stake.end_date);
  const goalTime = new Date(
    testMode
      ? voteEndDate.setDate(voteEndDate.getDate() + 1)
      : voteEndDate.setMonth(voteEndDate.getMonth() + 6)
  );

  if (goalTime.getTime() - now.getTime() < 1000) {
    return 0;
  }

  return goalTime.getTime() - now.getTime();
};

const algodClient = new algosdk.Algodv2(
  '',
  'https://mainnet-api.algonode.cloud',
  ''
);

const indexServer = 'https://mainnet-idx.algonode.cloud/';
const token = '';
const port = 443;
const tokenToSend = {
  'X-API-Key': token
};
const indexer = new Indexer(tokenToSend, indexServer, port);

const FRYIndex = 2485314946;

export interface Transaction {
  'close-rewards': number;
  'closing-amount': number;
  'asset-transfer-transaction': {
    amount: number;
    'asset-id': number;
  };
  'confirmed-round': number;
  fee: number;
  'first-valid': number;
  'genesis-hash': string;
  'genesis-id': string;
  id: string;
  'intra-round-offset': number;
  'last-valid': number;
  note: string;
  'payment-transaction': Object;
  'receiver-rewards': number;
  'round-time': number;
  sender: string;
  'sender-rewards': number;
  signature: Object;
  'tx-type': string;
}

export async function verifyTransaction(address: string, txId: string) {
  let checking = false;
  let checkingRetry = 0;

  try {
    while (!checking) {
      const lastTransactios = await indexer
        .lookupAccountTransactions(address)
        .limit(50)
        .do();

      if (lastTransactios !== undefined) {
        const targetTx = lastTransactios.transactions.find(
          (transaction: Transaction) => {
            return transaction.id === txId;
          }
        );

        if (targetTx) {
          checking = true;
          break;
        }
      }

      checkingRetry++;
      if (checkingRetry >= 20) {
        break;
      }
    }

    return checking;
  } catch (error) {
    console.error(address + ':' + error);
    return false;
  }
}

export async function withdraw(stakeInfo: Stake) {
  try {
    const account = algosdk.mnemonicToSecretKey(
      process.env.VOTE_WALLET_SECRET!
    );
    const from = account.addr.toString();
    const assetIndex = stakeInfo.assetId ? stakeInfo.assetId : FRYIndex;

    const suggestedParams = await algodClient.getTransactionParams().do();

    const noteInformation = {
      voteTitle: stakeInfo.voteTitle,
      address: stakeInfo.address,
      voteOption: stakeInfo.voteOption,
      votes: stakeInfo.votes,
      amount: stakeInfo.stakes
    };

    const enc = new TextEncoder();
    const note = enc.encode(JSON.stringify(noteInformation));

    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from,
      to: stakeInfo.address,
      amount: stakeInfo.stakes * 1_000_000,
      assetIndex: Number(stakeInfo.assetId ? stakeInfo.assetId : FRYIndex),
      note,
      suggestedParams
    });

    const signedTxn = txn.signTxn(account.sk);
    const tx = await algodClient.sendRawTransaction(signedTxn).do();
    const checking = await verifyTransaction(stakeInfo.address, tx.txId);

    if (checking) {
      return tx.txId;
    }

    return '';
  } catch (error) {
    console.error(stakeInfo.address + ':' + error);
    return '';
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const testMode = process.env.NEXT_PUBLIC_TEST === 'true' ? true : false;
  const query: {
    address: string;
    data: Stake;
  } = req.body;

  const { address, data } = query;

  if (address !== data.address) {
    console.log('Authentication failed');
    res.status(401).json({ message: 'Authentication failed' });
    return;
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const collection = db.collection(
      testMode ? 'test-dao-stakes' : 'dao-stakes'
    );

    const result = (await collection.findOne({
      address: address,
      voteTitle: data.voteTitle,
      voteOption: data.voteOption,
      assetId: data.assetId
    })) as Stake;

    if (!result) {
      console.log('Can not find out the stake information');
      res.status(200).json({
        success: false,
        message: 'Can not find out the stake information'
      });
      return;
    }
    if (calculateTimeLeft(result)) {
      console.log('Time is still left for withdrawing');
      res
        .status(200)
        .json({ success: false, message: 'Unable to withdraw now.' });
      return;
    }

    if (result.withdraw) {
      console.log('User is already withdrawed the stake token');
      res.status(200).json({ success: false, message: 'Already withdrawed.' });
      return;
    }

    await collection.updateOne(
      {
        address: address,
        voteTitle: data.voteTitle,
        assetId: data.assetId,
        voteOption: data.voteOption
      },
      {
        $set: {
          withdraw: true
        }
      }
    );

    const withdrawResult = await withdraw(data);
    res.status(200).json({
      success: withdrawResult.length > 0 ? true : false,
      message: withdrawResult
    });
  } catch (error) {
    console.error('Internal Server Error: ', error);
    res.status(500).json({ message: 'Internal server error' });
    return;
  }
}
