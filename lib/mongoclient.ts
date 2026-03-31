// This approach is taken from https://github.com/vercel/next.js/tree/canary/examples/with-mongodb
import { MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

function createMongoClientPromise() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('Invalid/Missing environment variable: "MONGO_URI"');
  }

  const client = new MongoClient(uri);
  return client.connect();
}

// Export a factory so builds do not require DB env vars at import time.
export default function clientPromiseFactory() {
  if (clientPromise) {
    return clientPromise;
  }

  if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so the value survives HMR.
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = createMongoClientPromise();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    clientPromise = createMongoClientPromise();
  }

  return clientPromise;
}

// Export a getter function for NextAuth MongoDB adapter
// This preserves lazy initialization - connection only made when actually called
export function getMongoClientPromise(): Promise<MongoClient> {
  return clientPromiseFactory();
}
