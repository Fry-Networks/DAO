import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../lib/mongoclient';
import { Stake } from '../../lib/stake-schema';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const data: {
    address: string;
  } = req.body;

  const { address } = data;

  const testMode = process.env.NEXT_PUBLIC_TEST === 'true' ? true : false;
  console.log(address);

  try {
    const client = await clientPromise();
    const db = client.db();
    const collection = db.collection(
      testMode ? 'test-dao-stakes' : 'dao-stakes'
    );

    const result = (await collection
      .find({ address: address })
      .toArray()) as Stake[];

    console.log(result);
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
