import { NextApiRequest, NextApiResponse } from 'next';
import algosdk from 'algosdk';
import clientPromise from '../../lib/mongoclient';
// Server-side algod: use DAO app's internal proxy (primary node, Nodely fallback)
const algodClient = new algosdk.Algodv2(
  '',
  'http://127.0.0.1:3012/api/algod',
  ''
);
const BURN_ADDRESS =
  'CM3FF3D3PNCZYD62A7LT6WWG4OBX2JAGVCDRRZRM373SUM6HNR4TFNKYYM';
const FRYIndex = 2485314946;
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const data: {
    vote_index: number;
    index: number;
    txId: string;
    priceValue: number;
    assetId: string;
  } = req.body;

  const { vote_index, index, txId, priceValue, assetId } = data;
  const testMode = process.env.NEXT_PUBLIC_TEST === 'true' ? true : false;
  try {
    let retries = 0;
    console.log('Checking transaction info for txId: ', txId);
    let transactionInfo = await algodClient
      .pendingTransactionInformation(txId)
      .do();
    while (!transactionInfo.confirmedRound && retries < 5) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      console.log('Retrying transaction info...');
      transactionInfo = await algodClient
        .pendingTransactionInformation(txId)
        .do();
      console.log(transactionInfo);
      retries++;
    }
    if (!transactionInfo.confirmedRound) {
      throw new Error('Transaction not confirmed');
    }
    console.log(
      'Transaction confirmed in round: ',
      transactionInfo.confirmedRound
    );

    const txn = transactionInfo.txn?.txn;
    if (!txn) {
      throw new Error('Transaction payload missing');
    }

    const note = Buffer.from(txn.note ?? new Uint8Array()).toString();
    const voteIndex = note.split('-')[0];
    if (parseInt(voteIndex, 10) !== index) {
      throw new Error('Invalid vote index');
    }
    const assetAmount = Number(txn.assetTransfer?.amount ?? 0);
    if (!assetAmount) {
      throw new Error('Asset amount missing from transaction');
    }
    const votes = assetAmount / 1e6 / priceValue;
    const client = await clientPromise();
    const db = client.db();
    const collection = db.collection(testMode ? 'test-dao' : 'dao');
    const stakeCollection = db.collection(
      testMode ? 'test-dao-stakes' : 'dao-stakes'
    );
    const currentVote = (await collection.find({ current: true }).toArray())[
      vote_index
    ];
    if (!currentVote) {
      throw new Error('No active vote found');
    }
    const sender = txn.sender.toString();
    console.log('Sender: ', sender);

    const newUser =
      currentVote.votes[index].different_people.indexOf(sender) === -1;
    if (newUser) {
      await collection.updateOne(
        { _id: currentVote._id, 'votes.option': index.toString() },
        {
          $set: { hadVotes: true },
          $inc: { 'votes.$.votes': votes },
          $push: { 'votes.$.different_people': sender }
        }
      );

      await stakeCollection.insertOne({
        voteTitle: currentVote.title,
        voteOption: index.toString(),
        votes: votes,
        stakes: assetAmount / 1e6,
        end_date: currentVote.end_date,
        assetId: assetId,
        address: sender
      });
    } else {
      await collection.updateOne(
        { _id: currentVote._id, 'votes.option': index.toString() },
        {
          $set: { hadVotes: true },
          $inc: { 'votes.$.votes': votes }
        }
      );

      await stakeCollection.updateOne(
        {
          voteTitle: currentVote.title,
          voteOption: index.toString(),
          address: sender,
          assetId: assetId
        },
        {
          $set: { end_date: currentVote.end_date },
          $inc: { stakes: assetAmount / 1e6, votes: votes }
        }
      );
    }

    res.status(200).json({ message: 'ok' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'error' });
  }
}
