// lib/cfip-schema.ts
// TypeScript types and configuration for Community Fry Improvement Proposals

import { ObjectId } from 'mongodb';

export type CFIPStatus =
  | 'draft'
  | 'pending_review'
  | 'community_voting'
  | 'approved_for_fip'
  | 'rejected'
  | 'vetoed'
  | 'promoted';

export interface CFIPAuthor {
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  discordDiscriminator?: string;
}

export interface CFIPVoter {
  discordId: string;
  discordUsername: string;
  vote: 'promote' | 'reject';
  timestamp: Date;
}

export interface CommunityVotes {
  promote: number;
  reject: number;
  voters: CFIPVoter[];
}

export interface CFIP {
  _id?: ObjectId;
  title: string;
  description: string;
  author: CFIPAuthor;
  status: CFIPStatus;
  community_votes: CommunityVotes;
  voting_start: Date | null;
  voting_end: Date | null;
  admin_notes: string | null;
  promoted_fip_id: ObjectId | null;
  vetoed_by: string | null;
  vetoed_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CFIPUser {
  _id?: ObjectId;
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  discordDiscriminator?: string;
  accountCreatedAt: Date | null;
  serverJoinedAt: Date | null;
  isServerMember: boolean;
  lastMembershipCheck: Date;
  submissionCount: number;
  lastSubmissionAt: Date | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  createdAt: Date;
  lastLogin: Date;
}

export const CFIP_CONFIG = {
  MIN_VOTES_REQUIRED: 10,
  PROMOTE_THRESHOLD_PERCENT: 60,
  DEFAULT_VOTING_PERIOD_DAYS: 7,
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 10000,
  MIN_DISCORD_ACCOUNT_AGE_DAYS: 30,
  MIN_SERVER_MEMBERSHIP_DAYS: 7,
  MAX_SUBMISSIONS_PER_WINDOW: 3,
  SUBMISSION_WINDOW_HOURS: 24 * 7,
  SUBMISSION_COOLDOWN_HOURS: 24,
  FRY_NETWORKS_GUILD_ID: process.env.FRY_NETWORKS_DISCORD_GUILD_ID || '',
  MEMBERSHIP_CHECK_INTERVAL_HOURS: 24,
  MIN_VOTING_PERIOD_HOURS: 48,
  MAX_VOTING_PERIOD_DAYS: 30,
  SUPER_MAJORITY_THRESHOLD_PERCENT: 67,
};

export function getDiscordAccountCreationDate(discordId: string): Date {
  const DISCORD_EPOCH = 1420070400000;
  const timestamp = Number(BigInt(discordId) >> 22n) + DISCORD_EPOCH;
  return new Date(timestamp);
}

export function isAccountOldEnough(discordId: string): boolean {
  const creationDate = getDiscordAccountCreationDate(discordId);
  const ageInDays = (Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays >= CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS;
}

export function isServerMemberLongEnough(joinedAt: Date | null): boolean {
  if (!joinedAt) return false;
  const membershipDays = (Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24);
  return membershipDays >= CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS;
}

export function canSubmitCFIP(
  submissionCount: number,
  lastSubmissionAt: Date | null
): { allowed: boolean; reason?: string; retryAfter?: Date } {
  if (lastSubmissionAt) {
    const cooldownMs = CFIP_CONFIG.SUBMISSION_COOLDOWN_HOURS * 60 * 60 * 1000;
    const timeSinceLastSubmission = Date.now() - lastSubmissionAt.getTime();
    if (timeSinceLastSubmission < cooldownMs) {
      const retryAfter = new Date(lastSubmissionAt.getTime() + cooldownMs);
      return { allowed: false, reason: `Please wait ${CFIP_CONFIG.SUBMISSION_COOLDOWN_HOURS} hours between submissions`, retryAfter };
    }
  }
  if (submissionCount >= CFIP_CONFIG.MAX_SUBMISSIONS_PER_WINDOW) {
    return { allowed: false, reason: `Maximum ${CFIP_CONFIG.MAX_SUBMISSIONS_PER_WINDOW} submissions per week reached` };
  }
  return { allowed: true };
}
