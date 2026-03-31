import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../lib/mongoclient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status } = req.query;

  try {
    const client = await clientPromise();
    const db = client.db('main');
    const collection = db.collection('dao');

    const query: any = {
      type: 'cfip',
      deleted: { $ne: true }
    };

    if (status && typeof status === 'string') {
      query.status = status;
    }

    const cfips = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .project({
        title: 1,
        description: 1,
        status: 1,
        author: 1,
        createdAt: 1,
        editedAt: 1,
        'votes.title': 1,
        'comments': { $size: '$comments' }
      })
      .toArray();

    // Transform to safe format
    const result = cfips.map((cfip) => ({
      id: cfip._id.toString(),
      title: cfip.title,
      description: cfip.description?.substring(0, 200) + (cfip.description?.length > 200 ? '...' : ''),
      status: cfip.status,
      author: cfip.author,
      createdAt: cfip.createdAt,
      editedAt: cfip.editedAt,
      optionCount: cfip.votes?.length || 0,
      commentCount: typeof cfip.comments === 'number' ? cfip.comments : (cfip.comments?.length || 0)
    }));

    return res.status(200).json({ cfips: result });
  } catch (error) {
    console.error('Failed to list cFIPs:', error);
    return res.status(500).json({ error: 'Failed to list cFIPs' });
  }
}
