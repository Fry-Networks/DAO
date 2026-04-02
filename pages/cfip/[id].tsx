import { useState } from 'react';
import { Button, Card, Flex, Title, Text, Badge, Textarea, Divider, Callout } from '@tremor/react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import clientPromise from '../../lib/mongoclient';
import { ObjectId } from 'mongodb';
import { marked } from 'marked';
import { sanitizeHtml } from '../../lib/sanitize-html';
import { RiEditLine, RiSendPlane2Line } from '@remixicon/react';
import { useWallet } from '../../lib/use-wallet-compat';
import TempCheckButton from '../../components/temp-check-button';
import TempCheckVote from '../../components/temp-check-vote';

interface Comment {
  id: string;
  discordId: string;
  name: string;
  image?: string;
  text: string;
  createdAt: string;
}

interface VoteOption {
  title: string;
  description: string;
}

interface CfipData {
  id: string;
  title: string;
  description: string;
  descriptionHtml: string;
  status: 'draft' | 'discussion' | 'voting' | 'closed';
  author: {
    discordId: string;
    name: string;
    image?: string;
  };
  authorWallet: string;
  createdAt: string;
  editedAt?: string;
  votes: VoteOption[];
  comments: Comment[];
}

const statusColors: Record<string, 'gray' | 'blue' | 'amber' | 'emerald'> = {
  draft: 'gray',
  discussion: 'blue',
  voting: 'amber',
  closed: 'emerald'
};

export default function CfipDetailPage({ cfip }: { cfip: CfipData | null }) {
  const { data: session } = useSession();
  const { activeAddress } = useWallet();
  const router = useRouter();
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  if (!cfip) {
    return (
      <main className="p-4 md:p-10 mx-auto max-w-4xl">
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
          <Title className="text-[var(--text-heading)]">cFIP Not Found</Title>
          <Text className="text-[var(--text-secondary)] mt-2">
            This proposal does not exist or has been deleted.
          </Text>
          <Link href="/cfip">
            <Button color="gray" className="mt-4">Back to Proposals</Button>
          </Link>
        </Card>
      </main>
    );
  }

  const isAuthor = session?.user && (session.user as any).discordId === cfip.author.discordId;
  const canEdit = isAuthor && (cfip.status === 'discussion' || cfip.status === 'draft');
  const canComment = cfip.status === 'discussion' || cfip.status === 'draft';
  const canRequestTempCheck = isAuthor && cfip.status === 'discussion';

  const submitComment = async () => {
    if (!session || !commentText.trim()) return;
    
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/cfip/${cfip.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText })
      });

      if (res.ok) {
        setCommentText('');
        router.replace(router.asPath); // Refresh page
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to post comment');
      }
    } catch (err) {
      setError('Failed to post comment');
    }

    setSubmitting(false);
  };

  const handleTempCheckSuccess = () => {
    setRefreshKey(k => k + 1);
    router.replace(router.asPath);
  };

  return (
    <main className="p-4 md:p-10 mx-auto max-w-4xl">
      {/* Header */}
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] mb-6">
        <Flex justifyContent="between" alignItems="start" className="mb-4">
          <div>
            <Flex alignItems="center" className="gap-2 mb-2">
              <Badge color={statusColors[cfip.status]}>{cfip.status}</Badge>
              {cfip.editedAt && (
                <Text className="text-[var(--text-secondary)] text-xs">edited</Text>
              )}
            </Flex>
            <Title className="text-[var(--text-heading)]">{cfip.title}</Title>
          </div>
          {canEdit && (
            <Link href={`/cfip/${cfip.id}/edit`}>
              <Button size="xs" color="gray" icon={RiEditLine}>Edit</Button>
            </Link>
          )}
        </Flex>
        
        <Flex alignItems="center" className="gap-3 text-sm text-[var(--text-secondary)] mb-4">
          <span className="flex items-center gap-1">
            {cfip.author.image && (
              <img src={cfip.author.image} alt="" className="w-5 h-5 rounded-full" />
            )}
            {cfip.author.name}
          </span>
          <span suppressHydrationWarning>{new Date(cfip.createdAt).toLocaleString()}</span>
        </Flex>

        <Divider />

        <div 
          className="markdown-content text-[var(--text-primary)] mt-4 break-words" style={{ overflowWrap: 'anywhere' }}
          dangerouslySetInnerHTML={{ __html: cfip.descriptionHtml }}
        />
      </Card>

      {/* Temperature Check */}
      <TempCheckVote 
        key={refreshKey} 
        cfipId={cfip.id} 
        onVoteSuccess={handleTempCheckSuccess} 
      />

      {/* Voting Options */}
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] mb-6">
        <Flex justifyContent="between" alignItems="center" className="mb-4">
          <Title className="text-[var(--text-heading)] text-lg">Voting Options</Title>
          {canRequestTempCheck && (
            <TempCheckButton 
              cfipId={cfip.id} 
              cfipTitle={cfip.title}
              onSuccess={handleTempCheckSuccess}
            />
          )}
        </Flex>
        <div className="space-y-3">
          {cfip.votes.map((option, index) => (
            <Card key={index} className="bg-[var(--bg-secondary)] p-4">
              <Text className="text-[var(--text-primary)] font-medium">
                Option {index + 1}: {option.title}
              </Text>
              {option.description && (
                <Text className="text-[var(--text-secondary)] text-sm mt-1">
                  {option.description}
                </Text>
              )}
            </Card>
          ))}
        </div>
      </Card>

      {/* Comments */}
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
        <Title className="text-[var(--text-heading)] text-lg mb-4">
          Discussion ({cfip.comments.length})
        </Title>

        {error && (
          <Callout title="Error" color="rose" className="mb-4">{error}</Callout>
        )}

        {/* Comment Form */}
        {canComment && (
          <div className="mb-6">
            {session ? (
              <div>
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts..."
                  rows={3}
                  className="bg-[var(--bg-secondary)] mb-2"
                />
                <Flex justifyContent="end">
                  <Button
                    onClick={submitComment}
                    disabled={!commentText.trim() || submitting}
                    color="rose"
                    icon={RiSendPlane2Line}
                  >
                    {submitting ? 'Posting...' : 'Post Comment'}
                  </Button>
                </Flex>
              </div>
            ) : (
              <Card className="bg-[var(--bg-secondary)] p-4 text-center">
                <Text className="text-[var(--text-secondary)] mb-2">
                  Sign in to join the discussion
                </Text>
                <Button onClick={() => signIn('discord')} color="rose" size="xs">
                  Sign in with Discord
                </Button>
              </Card>
            )}
          </div>
        )}

        {!canComment && (
          <Callout title="Notice" color="gray" className="mb-4">
            Comments are closed for this proposal.
          </Callout>
        )}

        {/* Comment List */}
        <div className="space-y-4">
          {cfip.comments.length === 0 ? (
            <Text className="text-[var(--text-secondary)] text-center py-4">
              No comments yet. Be the first to share your thoughts!
            </Text>
          ) : (
            cfip.comments.map((comment) => (
              <div key={comment.id} className="border-b border-[var(--border-color)] pb-4 last:border-0">
                <Flex alignItems="center" className="gap-2 mb-2">
                  {comment.image && (
                    <img src={comment.image} alt="" className="w-6 h-6 rounded-full" />
                  )}
                  <Text className="text-[var(--text-primary)] font-medium">{comment.name}</Text>
                  <Text className="text-[var(--text-secondary)] text-xs" suppressHydrationWarning>
                    {new Date(comment.createdAt).toLocaleString()}
                  </Text>
                </Flex>
                <Text className="text-[var(--text-primary)] whitespace-pre-wrap">
                  {comment.text}
                </Text>
              </div>
            ))
          )}
        </div>
      </Card>
    </main>
  );
}

export async function getServerSideProps({ params }: { params: { id: string } }) {
  try {
    const client = await clientPromise();
    const db = client.db('main');
    const collection = db.collection('dao');

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(params.id);
    } catch {
      return { props: { cfip: null } };
    }

    const cfip = await collection.findOne({
      _id: objectId,
      type: 'cfip',
      deleted: { $ne: true }
    });

    if (!cfip) {
      return { props: { cfip: null } };
    }

    const descriptionHtml = sanitizeHtml(await marked.parse(cfip.description || ''));

    return {
      props: {
        cfip: {
          id: cfip._id.toString(),
          title: cfip.title,
          description: cfip.description,
          descriptionHtml,
          status: cfip.status || 'discussion',
          author: cfip.author || { discordId: '', name: 'Unknown' },
          authorWallet: cfip.authorWallet || '',
          createdAt: cfip.createdAt,
          editedAt: cfip.editedAt || null,
          votes: cfip.votes?.map((v: any) => ({
            title: v.title,
            description: v.description || ''
          })) || [],
          comments: cfip.comments || []
        }
      }
    };
  } catch (error) {
    console.error('Failed to fetch cFIP:', error);
    return { props: { cfip: null } };
  }
}
