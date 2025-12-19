// lib/discord-utils.ts
// Discord API utilities for server membership verification

import { CFIP_CONFIG, getDiscordAccountCreationDate } from './cfip-schema';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface DiscordGuildMember {
  user?: { id: string; username: string; discriminator: string; avatar: string | null };
  nick?: string;
  avatar?: string;
  roles: string[];
  joined_at: string;
  premium_since?: string;
  deaf: boolean;
  mute: boolean;
  pending?: boolean;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
}

export interface MembershipCheckResult {
  isMember: boolean;
  joinedAt: Date | null;
  accountCreatedAt: Date;
  meetsAccountAgeRequirement: boolean;
  meetsServerMembershipRequirement: boolean;
  error?: string;
}

export async function verifyFryNetworksMembership(accessToken: string): Promise<MembershipCheckResult> {
  const guildId = CFIP_CONFIG.FRY_NETWORKS_GUILD_ID;
  if (!guildId) {
    console.error('FRY_NETWORKS_DISCORD_GUILD_ID not configured');
    return { isMember: false, joinedAt: null, accountCreatedAt: new Date(), meetsAccountAgeRequirement: false, meetsServerMembershipRequirement: false, error: 'Server verification not configured' };
  }
  try {
    const userResponse = await fetch(`${DISCORD_API_BASE}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!userResponse.ok) throw new Error(`Failed to fetch user info: ${userResponse.status}`);
    const user: DiscordUser = await userResponse.json();
    const accountCreatedAt = getDiscordAccountCreationDate(user.id);
    const accountAgeDays = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const meetsAccountAgeRequirement = accountAgeDays >= CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS;
    const guildsResponse = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!guildsResponse.ok) throw new Error(`Failed to fetch guilds: ${guildsResponse.status}`);
    const guilds: DiscordGuild[] = await guildsResponse.json();
    const isMember = guilds.some(guild => guild.id === guildId);
    if (!isMember) {
      return { isMember: false, joinedAt: null, accountCreatedAt, meetsAccountAgeRequirement, meetsServerMembershipRequirement: false };
    }
    return { isMember: true, joinedAt: null, accountCreatedAt, meetsAccountAgeRequirement, meetsServerMembershipRequirement: true };
  } catch (error) {
    console.error('Error verifying Discord membership:', error);
    return { isMember: false, joinedAt: null, accountCreatedAt: new Date(), meetsAccountAgeRequirement: false, meetsServerMembershipRequirement: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getGuildMemberInfo(userId: string): Promise<{ joinedAt: Date | null; roles: string[] } | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = CFIP_CONFIG.FRY_NETWORKS_GUILD_ID;
  if (!botToken || !guildId) return null;
  try {
    const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, { headers: { Authorization: `Bot ${botToken}` } });
    if (!response.ok) { if (response.status === 404) return null; throw new Error(`Failed to fetch member: ${response.status}`); }
    const member: DiscordGuildMember = await response.json();
    return { joinedAt: member.joined_at ? new Date(member.joined_at) : null, roles: member.roles };
  } catch (error) {
    console.error('Error fetching guild member info:', error);
    return null;
  }
}

export async function refreshDiscordToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  try {
    const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID!, client_secret: process.env.DISCORD_CLIENT_SECRET!, grant_type: 'refresh_token', refresh_token: refreshToken })
    });
    if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`);
    const data = await response.json();
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
  } catch (error) {
    console.error('Error refreshing Discord token:', error);
    return null;
  }
}

export interface EligibilityResult { eligible: boolean; reasons: string[]; warnings: string[]; }

export function checkUserEligibility(accountCreatedAt: Date, serverJoinedAt: Date | null, isServerMember: boolean): EligibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!isServerMember) reasons.push('You must be a member of the Fry Networks Discord server');
  const accountAgeDays = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (accountAgeDays < CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS) {
    const daysNeeded = Math.ceil(CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS - accountAgeDays);
    reasons.push(`Your Discord account must be at least ${CFIP_CONFIG.MIN_DISCORD_ACCOUNT_AGE_DAYS} days old. Please wait ${daysNeeded} more day(s).`);
  }
  if (serverJoinedAt) {
    const membershipDays = (Date.now() - serverJoinedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (membershipDays < CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS) {
      const daysNeeded = Math.ceil(CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS - membershipDays);
      reasons.push(`You must be a server member for at least ${CFIP_CONFIG.MIN_SERVER_MEMBERSHIP_DAYS} days. Please wait ${daysNeeded} more day(s).`);
    }
  } else if (isServerMember) {
    warnings.push('Unable to verify server join date. Your first CFIP action will start the membership timer.');
  }
  return { eligible: reasons.length === 0, reasons, warnings };
}
