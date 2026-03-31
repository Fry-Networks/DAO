import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth-options';
import clientPromise from '../../../lib/mongoclient';
import { checkFryBalance } from '../../../lib/fry-balance';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { title, description, options, walletAddress } = req.body;

  // Validation
  if (!title || typeof title !== 'string' || title.trim().length < 10) {
    return res.status(400).json({ error: 'Title must be at least 10 characters' });
  }
  if (!description || typeof description !== 'string' || description.trim().length < 50) {
    return res.status(400).json({ error: 'Description must be at least 50 characters' });
  }
  if (!options || !Array.isArray(options) || options.length < 2 || options.length > 8) {
    return res.status(400).json({ error: 'Must have 2-8 voting options' });
  }
  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  // FRY balance check
  try {
    const balanceResult = await checkFryBalance(walletAddress);
    if (!balanceResult.eligible) {
      return res.status(403).json({
        error: 'Insufficient FRY balance',
        required: balanceResult.required,
        balance: balanceResult.balance,
        thresholdUsd: balanceResult.thresholdUsd
      });
    }
  } catch (error) {
    console.error('FRY balance check failed:', error);
    return res.status(500).json({ error: 'Failed to verify FRY balance' });
  }

  // Validate options
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
    const cfip = {
      title: title.trim(),
      description: description.trim(),
      type: 'cfip',
      status: 'discussion',
      current: false,
      deleted: false,
      hadVotes: false,
      hidden: false,
      super_majority: false,
      total_votes: 0,
      createdAt: now.toISOString(),
      author: {
        discordId: (session.user as any).discordId,
        name: session.user.name || 'Unknown',
        image: session.user.image || undefined
      },
      authorWallet: walletAddress,
      votes: options.map((opt: any, idx: number) => ({
        option: idx.toString(),
        title: opt.title.trim(),
        description: opt.description?.trim() || '',
        votes: 0,
        different_people: []
      })),
      comments: []
    };

    const result = await collection.insertOne(cfip);

    return res.status(201).json({
      success: true,
      id: result.insertedId.toString(),
      message: 'cFIP created successfully'
    });
  } catch (error) {
    console.error('Failed to create cFIP:', error);
    return res.status(500).json({ error: 'Failed to create cFIP' });
  }
}
