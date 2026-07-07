import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth-options';
import clientPromise from '../../../lib/mongoclient';
import { sha512_256 } from 'js-sha512';

function makeVoteId(name: string): Uint8Array {
  const encoder = new TextEncoder();
  return new Uint8Array(sha512_256.array(encoder.encode(name)));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const discordId = (session.user as any).discordId;
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map(s => s.trim());
  if (!adminIds.includes(discordId)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { title, description, options, end_date } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length < 10) {
    return res.status(400).json({ error: 'Title must be at least 10 characters' });
  }
  if (!description || typeof description !== 'string' || description.trim().length < 50) {
    return res.status(400).json({ error: 'Description must be at least 50 characters' });
  }
  if (!options || !Array.isArray(options) || options.length < 2 || options.length > 8) {
    return res.status(400).json({ error: 'Must have 2-8 voting options' });
  }
  if (!end_date) {
    return res.status(400).json({ error: 'End date required' });
  }

  for (const opt of options) {
    if (!opt.title || typeof opt.title !== 'string' || opt.title.trim().length < 1) {
      return res.status(400).json({ error: 'Each option must have a title' });
    }
  }

  try {
    const client = await clientPromise();
    const db = client.db('main');
    const collection = db.collection('dao');

    const now = new Date();
    const endDate = new Date(end_date);
    if (isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid end date' });
    }

    const voteId = makeVoteId(title.trim());
    const contractVoteId = Array.from(voteId).map(b => b.toString(16).padStart(2, '0')).join('');

    // Race-guard: prevent duplicate FIP creation from double-submit
    const existing = await collection.findOne({ contractVoteId, deleted: { $ne: true } });
    if (existing) {
      return res.status(409).json({
        error: 'FIP with this title already exists',
        id: existing._id.toString()
      });
    }

    const fip = {
      title: title.trim(),
      description: description.trim(),
      type: 'fip',
      status: 'voting',
      current: true,
      deleted: false,
      hadVotes: false,
      hidden: true,
      super_majority: false,
      total_votes: 0,
      createdAt: now.toISOString(),
      end_date: endDate,
      author: {
        discordId: discordId,
        name: session.user.name || 'Unknown',
        image: session.user.image || undefined
      },
      contractVoteId,
      votes: options.map((opt: any, idx: number) => ({
        option: idx.toString(),
        title: opt.title.trim(),
        description: opt.description?.trim() || '',
        votes: 0,
        different_people: []
      })),
      comments: []
    };

    const result = await collection.insertOne(fip);

    return res.status(201).json({
      success: true,
      id: result.insertedId.toString(),
      message: 'FIP created successfully'
    });
  } catch (error) {
    console.error('Failed to create FIP:', error);
    return res.status(500).json({ error: 'Failed to create FIP' });
  }
}
