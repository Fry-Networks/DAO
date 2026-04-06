import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '../../lib/mongoclient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await clientPromise();
    const db = client.db('main');
    const dao = db.collection('dao');
    const stakes = db.collection('dao-stakes');

    // Vote stats
    const allVotes = await dao.find({ 
      type: { $ne: 'cfip' }, 
      deleted: { $ne: true } 
    }).toArray();

    let uniqueVoters = new Set<string>();
    let totalFryStaked = 0;
    let votesWithParticipation = 0;

    for (const vote of allVotes) {
      if (vote.votes && Array.isArray(vote.votes)) {
        for (const opt of vote.votes) {
          if (opt.different_people && Array.isArray(opt.different_people)) {
            opt.different_people.forEach((p: string) => uniqueVoters.add(p));
          }
          if (opt.votes) totalFryStaked += Number(opt.votes);
        }
        if (vote.total_votes > 0) votesWithParticipation++;
      }
    }

    const activeVotes = allVotes.filter(v => v.current === true).length;
    const contractVotes = allVotes.filter(v => v.contractVoteId).length;

    // cFIP stats
    const cfipAgg = await dao.aggregate([
      { $match: { type: 'cfip', deleted: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();

    const cfipByStatus: Record<string, number> = {};
    let totalCfips = 0;
    for (const s of cfipAgg) {
      cfipByStatus[s._id || 'unknown'] = s.count;
      totalCfips += s.count;
    }

    // V1 stakes
    const v1StakeCount = await stakes.countDocuments();

    return res.status(200).json({
      votes: {
        total: allVotes.length,
        active: activeVotes,
        completed: allVotes.length - activeVotes,
        contractBased: contractVotes,
        withParticipation: votesWithParticipation
      },
      participation: {
        uniqueVoters: uniqueVoters.size,
        totalFryStaked
      },
      cfips: {
        total: totalCfips,
        byStatus: cfipByStatus
      },
      stakes: {
        v1Count: v1StakeCount
      }
    });
  } catch (error) {
    console.error('Error fetching governance stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
