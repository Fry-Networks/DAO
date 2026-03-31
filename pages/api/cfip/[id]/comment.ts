import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth-options';
import clientPromise from '../../../../lib/mongoclient';
import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { id } = req.query;
  const { text } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid cFIP ID' });
  }

  if (!text || typeof text !== 'string' || text.trim().length < 1) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  if (text.length > 2000) {
    return res.status(400).json({ error: 'Comment must be under 2000 characters' });
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

    // Check cFIP exists
    const cfip = await collection.findOne({
      _id: objectId,
      type: 'cfip',
      deleted: { $ne: true }
    });

    if (!cfip) {
      return res.status(404).json({ error: 'cFIP not found' });
    }

    // Can only comment during discussion phase
    if (cfip.status !== 'discussion' && cfip.status !== 'draft') {
      return res.status(403).json({ error: 'Comments are closed for this cFIP' });
    }

    const comment = {
      id: randomUUID(),
      discordId: (session.user as any).discordId,
      name: session.user.name || 'Unknown',
      image: session.user.image || undefined,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    await collection.updateOne(
      { _id: objectId },
      { $push: { comments: comment } }
    );

    return res.status(201).json({ success: true, comment });
  } catch (error) {
    console.error('Failed to add comment:', error);
    return res.status(500).json({ error: 'Failed to add comment' });
  }
}
