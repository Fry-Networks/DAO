import clientPromise from '../lib/mongoclient';
import { Stake } from '../lib/stake-schema';
import { Vote } from '../lib/vote-schema';

export default function StakePage() {
  return <main className="p-4 md:p-10 mx-auto max-w-7xl"></main>;
}

export async function getServerSideProps(context: any) {
  try {
    const client = await clientPromise;
    const db = client.db('main');

    const stakeCollection = db.collection('dao-stakes');
    const voteCollection = db.collection('dao');

    const stakes = (await stakeCollection.find({}).toArray()) as Stake[];
    const votes = (await voteCollection.find({}).toArray()) as Vote[];
    return {
      props: {
        stakes: [],
        votes: []
      }
    };
  } catch (error) {
    console.error(error);
  }
}
