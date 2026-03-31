import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth-options';
import clientPromise from '../../../../lib/mongoclient';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { id } = req.query;
  const { title, description, options } = req.body;

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

    // Get existing cFIP
    const cfip = await collection.findOne({
      _id: objectId,
      type: 'cfip',
      deleted: { $ne: true }
    });

    if (!cfip) {
      return res.status(404).json({ error: 'cFIP not found' });
    }

    // Check author
    const userDiscordId = (session.user as any).discordId;
    if (cfip.author?.discordId !== userDiscordId) {
      return res.status(403).json({ error: 'Only the author can edit this cFIP' });
    }

    // Check status - can only edit during discussion phase
    if (cfip.status !== 'discussion' && cfip.status !== 'draft') {
      return res.status(403).json({ error: 'Cannot edit cFIP after voting has started' });
    }

    // Build update
    const update: any = {
      editedAt: new Date().toISOString()
    };

    if (title && typeof title === 'string' && title.trim().length >= 10) {
      update.title = title.trim();
    }
    if (description && typeof description === 'string' && description.trim().length >= 50) {
      update.description = description.trim();
    }
    if (options && Array.isArray(options) && options.length >= 2 && options.length <= 8) {
      update.votes = options.map((opt: any, idx: number) => ({
        option: idx.toString(),
        title: opt.title?.trim() || '',
        description: opt.description?.trim() || '',
        votes: 0,
        different_people: []
      }));
    }

    await collection.updateOne({ _id: objectId }, { $set: update });

    return res.status(200).json({ success: true, message: 'cFIP updated successfully' });
  } catch (error) {
    console.error('Failed to edit cFIP:', error);
    return res.status(500).json({ error: 'Failed to edit cFIP' });
  }
}
