// pages/api/cfip/submit.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import clientPromise from '../../../lib/mongoclient';
import { CFIP, CFIP_CONFIG, canSubmitCFIP, getDiscordAccountCreationDate } from '../../../lib/cfip-schema';
import { verifyFryNetworksMembership } from '../../../lib/discord-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.status(405).json({ message: 'Method Not Allowed' }); return; }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) { res.status(401).json({ message: 'Unauthorized - Please log in with Discord' }); return; }

  const provider = (session.user as any).provider;
  const discordId = (session.user as any).providerAccountId;

  if (provider !== 'discord') { res.status(403).json({ message: 'CFIPs must be submitted using Discord authentication' }); return; }
  if (!discordId) { res.status(403).json({ message: 'Invalid Discord session' }); return; }

  try {
    const client = await clientPromise;
    const db = client.db('main');
    const cfipUsersCollection = db.collection('cfip-users');
    const cfipCollection = db.collection('cfips');
    const cfipUser = await cfipUsersCollection.findOne({ discordId });

    if (!cfipUser) { res.status(403).json({ message: 'User record not found. Please log out and log in again.' }); return; }

    // Check server membership
    if (!cfipUser.isServerMember) {
      if (cfipUser.accessToken) {
        const membershipCheck = await verifyFryNetworksMembership(cfipUser.accessToken);
        if (!membershipCheck.isMember) {
          res.status(403).json({ message: 'You must be a member of the Fry Networks Discord server to submit CFIPs', action: 'join_server', serverInvite: process.env.FRY_NETWORKS_DISCORD_INVITE || 'https://discord.gg/frynetworks' });
          return;
        }
        await cfipUsersCollection.updateOne({ discordId }, { $set: { isServerMember: true, lastMembershipCheck: new Date(), ...(!cfipUser.serverJoinedAt ? { serverJoinedAt: new Date() } : {}) } });
      } else {
        res.status(403).json({ message: 'You must be a member of the Fry Networks Discord server to submit CFIPs', action: 'join_server' });
        return;
      }
    }

    // Check account age
    const accountCreatedAt = cfipUser.accountCreatedAt ? new Date(cfipUser.accountCreatedAt) : getDiscordAccountCreationDate(discordId);
    const accountAgeDays = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS) {
      const daysRemaining = Math.ceil(CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS - accountAgeDays);
      res.status(403).json({ message: `Your Discord account must be at least ${CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS} days old. Please wait ${daysRemaining} more day(s).`, action: 'wait', daysRemaining });
      return;
    }

    // Check membership duration
    const serverJoinedAt = cfipUser.serverJoinedAt ? new Date(cfipUser.serverJoinedAt) : null;
    if (!serverJoinedAt) {
      await cfipUsersCollection.updateOne({ discordId }, { $set: { serverJoinedAt: new Date() } });
      res.status(403).json({ message: `You must be a Fry Networks server member for at least ${CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS} days. Your membership timer has now started.`, action: 'wait', daysRemaining: CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS });
      return;
    }
    const membershipDays = (Date.now() - serverJoinedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (membershipDays < CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS) {
      const daysRemaining = Math.ceil(CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS - membershipDays);
      res.status(403).json({ message: `You must be a Fry Networks server member for at least ${CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS} days. Please wait ${daysRemaining} more day(s).`, action: 'wait', daysRemaining });
      return;
    }

    // Rate limiting
    const rateCheck = canSubmitCFIP(cfipUser.submissionCount || 0, cfipUser.lastSubmissionAt ? new Date(cfipUser.lastSubmissionAt) : null);
    if (!rateCheck.allowed) { res.status(429).json({ message: rateCheck.reason, action: 'rate_limited', retryAfter: rateCheck.retryAfter?.toISOString() }); return; }

    // Validate input
    const { title, description } = req.body;
    if (!title || typeof title !== 'string') { res.status(400).json({ message: 'Title is required' }); return; }
    if (!description || typeof description !== 'string') { res.status(400).json({ message: 'Description is required' }); return; }

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (trimmedTitle.length > CFIP_CONFIG.MAX_TITLE_LENGTH) { res.status(400).json({ message: `Title must be ${CFIP_CONFIG.MAX_TITLE_LENGTH} characters or less` }); return; }
    if (trimmedDescription.length > CFIP_CONFIG.MAX_DESCRIPTION_LENGTH) { res.status(400).json({ message: `Description must be ${CFIP_CONFIG.MAX_DESCRIPTION_LENGTH} characters or less` }); return; }
    if (trimmedTitle.length < 10) { res.status(400).json({ message: 'Title must be at least 10 characters' }); return; }
    if (trimmedDescription.length < 100) { res.status(400).json({ message: 'Description must be at least 100 characters' }); return; }

    // Check duplicates
    const existingCFIP = await cfipCollection.findOne({ 'author.discordId': discordId, title: trimmedTitle, status: { $nin: ['rejected', 'vetoed'] } });
    if (existingCFIP) { res.status(409).json({ message: 'You already have an active CFIP with this title' }); return; }

    // Create CFIP
    const newCFIP: CFIP = {
      title: trimmedTitle,
      description: trimmedDescription,
      author: { discordId, discordUsername: session.user.name || 'Unknown', discordAvatar: session.user.image || null },
      status: 'pending_review',
      community_votes: { promote: 0, reject: 0, voters: [] },
      voting_start: null,
      voting_end: null,
      admin_notes: null,
      promoted_fip_id: null,
      vetoed_by: null,
      vetoed_at: null,
      approved_by: null,
      approved_at: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    const result = await cfipCollection.insertOne(newCFIP);

    // Update rate limit counters
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - CFIP_CONFIG.SUBMISSION_WINDOW_HOURS);
    const recentSubmissions = await cfipCollection.countDocuments({ 'author.discordId': discordId, created_at: { $gte: windowStart } });
    await cfipUsersCollection.updateOne({ discordId }, { $set: { submissionCount: recentSubmissions, lastSubmissionAt: new Date() } });

    console.log(`CFIP submitted: "${trimmedTitle}" by ${session.user.name} (${discordId})`);
    res.status(201).json({ message: 'CFIP submitted successfully! It will be reviewed by Fry Networks before opening for community voting.', cfipId: result.insertedId.toString() });
  } catch (error) {
    console.error('Error submitting CFIP:', error);
    res.status(500).json({ message: 'Error submitting CFIP' });
  }
}
