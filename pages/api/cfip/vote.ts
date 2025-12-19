// pages/api/cfip/vote.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import clientPromise from '../../../lib/mongoclient';
import { ObjectId } from 'mongodb';
import { CFIP_CONFIG, getDiscordAccountCreationDate } from '../../../lib/cfip-schema';
import { verifyFryNetworksMembership } from '../../../lib/discord-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.status(405).json({ message: 'Method Not Allowed' }); return; }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) { res.status(401).json({ message: 'Unauthorized - Please log in with Discord' }); return; }

  const provider = (session.user as any).provider;
  const discordId = (session.user as any).providerAccountId;

  if (provider !== 'discord') { res.status(403).json({ message: 'CFIP voting requires Discord authentication' }); return; }
  if (!discordId) { res.status(403).json({ message: 'Invalid Discord session' }); return; }

  try {
    const client = await clientPromise;
    const db = client.db('main');
    const cfipUsersCollection = db.collection('cfip-users');
    const cfipCollection = db.collection('cfips');
    const cfipUser = await cfipUsersCollection.findOne({ discordId });

    if (!cfipUser) { res.status(403).json({ message: 'User record not found. Please log out and log in again.' }); return; }

    // Check membership with periodic recheck
    const lastCheck = cfipUser.lastMembershipCheck ? new Date(cfipUser.lastMembershipCheck) : null;
    const checkIntervalMs = CFIP_CONFIG.MEMBERSHIP_CHECK_INTERVAL_HOURS * 60 * 60 * 1000;
    const needsRecheck = !lastCheck || (Date.now() - lastCheck.getTime() > checkIntervalMs);

    if (!cfipUser.isServerMember || needsRecheck) {
      if (cfipUser.accessToken) {
        const membershipCheck = await verifyFryNetworksMembership(cfipUser.accessToken);
        await cfipUsersCollection.updateOne({ discordId }, { $set: { isServerMember: membershipCheck.isMember, lastMembershipCheck: new Date() } });
        if (!membershipCheck.isMember) {
          res.status(403).json({ message: 'You must be a member of the Fry Networks Discord server to vote on CFIPs', action: 'join_server', serverInvite: process.env.FRY_NETWORKS_DISCORD_INVITE || 'https://discord.gg/frynetworks' });
          return;
        }
      } else if (!cfipUser.isServerMember) {
        res.status(403).json({ message: 'You must be a member of the Fry Networks Discord server to vote on CFIPs', action: 'join_server' });
        return;
      }
    }

    // Check account age
    const accountCreatedAt = cfipUser.accountCreatedAt ? new Date(cfipUser.accountCreatedAt) : getDiscordAccountCreationDate(discordId);
    const accountAgeDays = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS) {
      const daysRemaining = Math.ceil(CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS - accountAgeDays);
      res.status(403).json({ message: `Your Discord account must be at least ${CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS} days old to vote. Please wait ${daysRemaining} more day(s).`, action: 'wait', daysRemaining });
      return;
    }

    // Check membership duration
    const serverJoinedAt = cfipUser.serverJoinedAt ? new Date(cfipUser.serverJoinedAt) : null;
    if (!serverJoinedAt) {
      await cfipUsersCollection.updateOne({ discordId }, { $set: { serverJoinedAt: new Date() } });
      res.status(403).json({ message: `You must be a Fry Networks server member for at least ${CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS} days to vote. Your membership timer has now started.`, action: 'wait', daysRemaining: CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS });
      return;
    }
    const membershipDays = (Date.now() - serverJoinedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (membershipDays < CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS) {
      const daysRemaining = Math.ceil(CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS - membershipDays);
      res.status(403).json({ message: `You must be a Fry Networks server member for at least ${CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS} days. Please wait ${daysRemaining} more day(s).`, action: 'wait', daysRemaining });
      return;
    }

    // Validate input
    const { cfipId, vote } = req.body;
    if (!cfipId || typeof cfipId !== 'string') { res.status(400).json({ message: 'CFIP ID is required' }); return; }
    if (!vote || !['promote', 'reject'].includes(vote)) { res.status(400).json({ message: 'Vote must be "promote" or "reject"' }); return; }

    // Fetch CFIP
    const cfip = await cfipCollection.findOne({ _id: new ObjectId(cfipId) });
    if (!cfip) { res.status(404).json({ message: 'CFIP not found' }); return; }
    if (cfip.status !== 'community_voting') { res.status(400).json({ message: 'This CFIP is not currently open for community voting' }); return; }
    if (cfip.voting_end && new Date() > new Date(cfip.voting_end)) { res.status(400).json({ message: 'Voting period has ended for this CFIP' }); return; }

    // Process vote
    const existingVote = cfip.community_votes.voters.find((v: any) => v.discordId === discordId);
    if (existingVote) {
      if (existingVote.vote === vote) { res.status(400).json({ message: 'You have already cast this vote' }); return; }
      const oldVote = existingVote.vote;
      await cfipCollection.updateOne(
        { _id: new ObjectId(cfipId), 'community_votes.voters.discordId': discordId },
        { $set: { 'community_votes.voters.$.vote': vote, 'community_votes.voters.$.timestamp': new Date(), updated_at: new Date() }, $inc: { [`community_votes.${vote}`]: 1, [`community_votes.${oldVote}`]: -1 } }
      );
      console.log(`CFIP vote changed: ${session.user.name} (${discordId}) - ${oldVote} -> ${vote} on ${cfipId}`);
      res.status(200).json({ message: 'Vote updated successfully' });
      return;
    }

    // Add new vote
    await cfipCollection.updateOne(
      { _id: new ObjectId(cfipId) },
      { $inc: { [`community_votes.${vote}`]: 1 }, $push: { 'community_votes.voters': { discordId, discordUsername: session.user.name, vote, timestamp: new Date() } } as any, $set: { updated_at: new Date() } }
    );
    console.log(`CFIP vote cast: ${session.user.name} (${discordId}) - ${vote} on ${cfipId}`);

    // Check threshold for auto-status update
    const updatedCFIP = await cfipCollection.findOne({ _id: new ObjectId(cfipId) });
    if (updatedCFIP) {
      const totalVotes = updatedCFIP.community_votes.promote + updatedCFIP.community_votes.reject;
      if (totalVotes >= CFIP_CONFIG.MIN_VOTES_REQUIRED) {
        const promotePercent = (updatedCFIP.community_votes.promote / totalVotes) * 100;
        if (promotePercent >= CFIP_CONFIG.PROMOTE_THRESHOLD_PERCENT) {
          await cfipCollection.updateOne({ _id: new ObjectId(cfipId) }, { $set: { status: 'approved_for_fip', updated_at: new Date() } });
          console.log(`CFIP ${cfipId} reached community approval threshold`);
        } else if ((100 - promotePercent) >= CFIP_CONFIG.PROMOTE_THRESHOLD_PERCENT) {
          await cfipCollection.updateOne({ _id: new ObjectId(cfipId) }, { $set: { status: 'rejected', updated_at: new Date() } });
          console.log(`CFIP ${cfipId} was rejected by community vote`);
        }
      }
    }
    res.status(200).json({ message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Error voting on CFIP:', error);
    res.status(500).json({ message: 'Error recording vote' });
  }
}
