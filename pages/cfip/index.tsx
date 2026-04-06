import { useState } from 'react';
import { Button, Card, Flex, Title, Text, Badge, Tab, TabGroup, TabList } from '@tremor/react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import clientPromise from '../../lib/mongoclient';

interface CfipSummary {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'discussion' | 'voting' | 'closed';
  author: {
    discordId: string;
    name: string;
    image?: string;
  };
  createdAt: string;
  optionCount: number;
  commentCount: number;
}

const statusColors: Record<string, 'gray' | 'blue' | 'amber' | 'emerald'> = {
  draft: 'gray',
  discussion: 'blue',
  voting: 'amber',
  closed: 'emerald'
};

export default function CfipListPage({ cfips }: { cfips: CfipSummary[] }) {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<number>(0);

  const statuses = ['all', 'discussion', 'voting', 'closed'];
  const filteredCfips = filter === 0 
    ? cfips 
    : cfips.filter(c => c.status === statuses[filter]);

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      <Flex justifyContent="between" alignItems="center" className="mb-4">
        <Title className="text-[var(--text-heading)]">Community Proposals (cFIP)</Title>
        {session && (
          <Link href="/cfip/new">
            <Button color="rose">Submit cFIP</Button>
          </Link>
        )}
      </Flex>

      <Text className="text-[var(--text-secondary)] mb-6 max-w-3xl">
        Community FIPs (cFIPs) let any eligible FRY holder propose changes to the network. 
        Submit a proposal, discuss with the community, and if approved through founder review, 
        it advances to a full on-chain vote.
      </Text>

      <TabGroup index={filter} onIndexChange={setFilter} className="mb-6">
        <TabList variant="solid">
          <Tab>All</Tab>
          <Tab>Discussion</Tab>
          <Tab>Voting</Tab>
          <Tab>Closed</Tab>
        </TabList>
      </TabGroup>

      {filteredCfips.length === 0 ? (
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
          <Text className="text-[var(--text-secondary)] text-center py-8">
            No cFIPs found. {session ? 'Be the first to submit one!' : 'Sign in to submit a proposal.'}
          </Text>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCfips.map((cfip) => (
            <Link key={cfip.id} href={`/cfip/${cfip.id}`}>
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[#e74c3c] transition-colors cursor-pointer">
                <Flex justifyContent="between" alignItems="start">
                  <div className="flex-1">
                    <Flex alignItems="center" className="gap-2 mb-2">
                      <Title className="text-[var(--text-heading)]">{cfip.title}</Title>
                      <Badge color={statusColors[cfip.status]}>{cfip.status}</Badge>
                    </Flex>
                    <Text className="text-[var(--text-secondary)] mb-3">{cfip.description}</Text>
                    <Flex className="gap-4 text-sm text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1">
                        {cfip.author.image && (
                          <img src={cfip.author.image} alt="" className="w-4 h-4 rounded-full" />
                        )}
                        {cfip.author.name}
                      </span>
                      <span>{cfip.optionCount} options</span>
                      <span>{cfip.commentCount} comments</span>
                      <span>{new Date(cfip.createdAt).toLocaleDateString()}</span>
                    </Flex>
                  </div>
                </Flex>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export async function getServerSideProps() {
  try {
    const client = await clientPromise();
    const db = client.db('main');
    const collection = db.collection('dao');

    const cfips = await collection
      .find({
        type: 'cfip',
        deleted: { $ne: true }
      })
      .sort({ createdAt: -1 })
      .toArray();

    const result = cfips.map((cfip) => ({
      id: cfip._id.toString(),
      title: cfip.title,
      description: cfip.description?.substring(0, 200) + (cfip.description?.length > 200 ? '...' : ''),
      status: cfip.status || 'discussion',
      author: cfip.author || { discordId: '', name: 'Unknown' },
      createdAt: cfip.createdAt,
      optionCount: cfip.votes?.length || 0,
      commentCount: cfip.comments?.length || 0
    }));

    return { props: { cfips: result } };
  } catch (error) {
    console.error('Failed to fetch cFIPs:', error);
    return { props: { cfips: [] } };
  }
}
