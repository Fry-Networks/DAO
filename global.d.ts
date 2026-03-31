import type { MongoClient } from 'mongodb';
import type { DefaultSession } from 'next-auth';

declare module globalThis {
  var _mongoClientPromise: Promise<MongoClient>;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      discordId: string;
    } & DefaultSession['user'];
  }
}
