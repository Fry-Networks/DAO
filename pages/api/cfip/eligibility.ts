// pages/api/cfip/eligibility.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import clientPromise from '../../../lib/mongoclient';
import { CFIP_CONFIG, getDiscordAccountCreationDate, canSubmitCFIP } from '../../../lib/cfip-schema';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') { res.status(405).json({ message: 'Method Not Allowed' }); return; }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) { res.status(401).json({ message: 'Unauthorized' }); return; }

  const provider = (session.user as any).provider;
  const discordId = (session.user as any).providerAccountId;

  if (provider !== 'discord') {
    res.status(200).json({ isServerMember: false, accountAgeDays: 0, membershipDays: 0, canSubmit: false, canVote: false, reasons: ['Must use Discord authentication'] });
    return;
  }
  if (!discordId) {
    res.status(200).json({ isServerMember: false, accountAgeDays: 0, membershipDays: 0, canSubmit: false, canVote: false, reasons: ['Invalid Discord session'] });
    return;
  }

  try {
    const client = await clientPromise;
    const db = client.db('main');
    const cfipUser = await db.collection('cfip-users').findOne({ discordId });

    if (!cfipUser) {
      res.status(200).json({ isServerMember: false, accountAgeDays: 0, membershipDays: 0, canSubmit: false, canVote: false, reasons: ['User record not found. Please log out and log in again.'] });
      return;
    }

    const accountCreatedAt = cfipUser.accountCreatedAt ? new Date(cfipUser.accountCreatedAt) : getDiscordAccountCreationDate(discordId);
    const accountAgeDays = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const serverJoinedAt = cfipUser.serverJoinedAt ? new Date(cfipUser.serverJoinedAt) : null;
    const membershipDays = serverJoinedAt ? (Date.now() - serverJoinedAt.getTime()) / (1000 * 60 * 60 * 24) : 0;

    const reasons: string[] = [];
    if (!cfipUser.isServerMember) reasons.push('Must be a member of the Fry Networks Discord server');
    if (accountAgeDays < CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS) {
      const daysNeeded = Math.ceil(CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS - accountAgeDays);
      reasons.push(`Discord account must be ${CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS}+ days old (${daysNeeded} more days)`);
    }
    if (membershipDays < CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS) {
      const daysNeeded = Math.ceil(CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS - membershipDays);
      reasons.push(`Must be server member for ${CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS}+ days (${daysNeeded} more days)`);
    }

    const canVote = reasons.length === 0;
    const rateCheck = canSubmitCFIP(cfipUser.submissionCount || 0, cfipUser.lastSubmissionAt ? new Date(cfipUser.lastSubmissionAt) : null);
    const canSubmit = canVote && rateCheck.allowed;
    if (!rateCheck.allowed && canVote) reasons.push(rateCheck.reason || 'Rate limited');

    res.status(200).json({
      isServerMember: cfipUser.isServerMember,
      accountAgeDays,
      membershipDays,
      canSubmit,
      canVote,
      reasons,
      submissionCount: cfipUser.submissionCount || 0,
      maxSubmissions: CFIP_CONFIG.MAX_SUBMISSIONS_PER_WINDOW,
      lastSubmissionAt: cfipUser.lastSubmissionAt,
      retryAfter: rateCheck.retryAfter?.toISOString()
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({ message: 'Error checking eligibility' });
  }
}
