import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../../lib/mongoclient';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid cFIP ID' });
  }

  try {
    const client = await clientPromise();
    const db = client.db('main');
    const collection = db.collection('dao');

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return res.status(400).json({ error: 'Invalid cFIP ID format' });
    }

    const cfip = await collection.findOne({
      _id: objectId,
      type: 'cfip',
      deleted: { $ne: true }
    });

    if (!cfip) {
      return res.status(404).json({ error: 'cFIP not found' });
    }

    return res.status(200).json({
      id: cfip._id.toString(),
      title: cfip.title,
      description: cfip.description,
      status: cfip.status,
      author: cfip.author,
      authorWallet: cfip.authorWallet,
      createdAt: cfip.createdAt,
      editedAt: cfip.editedAt,
      votes: cfip.votes,
      comments: cfip.comments || [],
      super_majority: cfip.super_majority,
      end_date: cfip.end_date
    });
  } catch (error) {
    console.error('Failed to get cFIP:', error);
    return res.status(500).json({ error: 'Failed to get cFIP' });
  }
}
