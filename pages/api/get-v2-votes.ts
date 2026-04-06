import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../lib/mongoclient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const testMode = process.env.NEXT_PUBLIC_TEST === 'true';

  try {
    const client = await clientPromise();
    const db = client.db();
    const collection = db.collection(testMode ? 'test-dao' : 'dao');

    // Find all votes that have a contractVoteId (V2 contract votes)
    const votes = await collection
      .find({
        contractVoteId: { $exists: true, $ne: null }
      })
      .project({
        _id: 1,
        title: 1,
        contractVoteId: 1,
        end_date: 1,
        current: 1,
        status: 1
      })
      .toArray();

    res.status(200).json({ data: votes });
  } catch (error) {
    console.error('Error fetching V2 votes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
