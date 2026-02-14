import type { MongoClient } from 'mongodb';

declare module globalThis {
  var _mongoClientPromise: Promise<MongoClient>;
}
