import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../lib/mongoclient';
import { Stake } from '../../lib/stake-schema';
import { getServerSession } from 'next-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const data: {
    address: string;
  } = req.body;

  const { address } = data;

  try {
    const client = await clientPromise;
    const db = client.db();
    const collection = db.collection('dao-stakes');

    const result = (await collection
      .find({ address: address })
      .toArray()) as Stake[];
    if (result.length > 0) {
      res.status(200).json({ status: true, data: result });
    } else {
      res.status(200).json({ status: false, data: [] });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
    return;
  }
}
