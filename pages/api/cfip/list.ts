// pages/api/cfip/list.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import clientPromise from '../../../lib/mongoclient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') { res.status(405).json({ message: 'Method Not Allowed' }); return; }

  const session = await getServerSession(req, res, authOptions);

  try {
    const { status, page = 1, limit = 20, includeMyVote = false } = req.query;
    const client = await clientPromise;
    const db = client.db('main');
    const collection = db.collection('cfips');
    const query: any = {};

    // Filter by status
    if (status) {
      query.status = Array.isArray(status) ? { $in: status } : status;
    } else {
      // Default: only show public statuses
      query.status = { $in: ['community_voting', 'approved_for_fip', 'promoted'] };
    }

    const userDiscordId = session?.user ? (session.user as any).providerAccountId : null;

    // If user is logged in, also show their own CFIPs regardless of status
    if (userDiscordId && !status) {
      query.$or = [
        { status: { $in: ['community_voting', 'approved_for_fip', 'promoted'] } },
        { 'author.discordId': userDiscordId }
      ];
      delete query.status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [cfips, totalCount] = await Promise.all([
      collection.find(query).sort({ created_at: -1 }).skip(skip).limit(Number(limit)).toArray(),
      collection.countDocuments(query)
    ]);

    // Add user's vote to each CFIP if requested
    let cfipsWithVotes = cfips;
    if (includeMyVote === 'true' && userDiscordId) {
      cfipsWithVotes = cfips.map((cfip: any) => {
        const userVote = cfip.community_votes?.voters?.find((v: any) => v.discordId === userDiscordId);
        return { ...cfip, myVote: userVote?.vote || null };
      });
    }

    // Sanitize for public view (hide voter details and admin notes)
    const sanitizedCFIPs = cfipsWithVotes.map((cfip: any) => ({
      ...cfip,
      community_votes: {
        promote: cfip.community_votes.promote,
        reject: cfip.community_votes.reject,
        voterCount: cfip.community_votes.voters?.length || 0
      },
      myVote: cfip.myVote,
      admin_notes: undefined
    }));

    res.status(200).json({
      cfips: sanitizedCFIPs,
      pagination: { page: Number(page), limit: Number(limit), totalCount, totalPages: Math.ceil(totalCount / Number(limit)) }
    });
  } catch (error) {
    console.error('Error listing CFIPs:', error);
    res.status(500).json({ message: 'Error fetching CFIPs' });
  }
}
