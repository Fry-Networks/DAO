import type { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { getMongoClientPromise } from './mongoclient';

const DISCORD_SCOPES = ['identify', 'guilds'].join(' ');

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  adapter: MongoDBAdapter(getMongoClientPromise(), {
    collections: {
      Accounts: 'dao_accounts',
      Sessions: 'dao_sessions',
      Users: 'dao_users',
      VerificationTokens: 'dao_verification_tokens',
    },
    databaseName: 'main',
  }),

  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      authorization: { params: { scope: DISCORD_SCOPES } },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.discordId = account?.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).discordId = token.discordId;
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === 'development',
};
