import { useState, useEffect } from 'react';
import { Button, Card, Flex, Title, Text, TextInput, Textarea, Callout } from '@tremor/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import clientPromise from '../../../lib/mongoclient';
import { ObjectId } from 'mongodb';
import { RiAddLine, RiDeleteBinLine, RiArrowLeftLine } from '@remixicon/react';

interface VoteOption {
  title: string;
  description: string;
}

interface CfipData {
  id: string;
  title: string;
  description: string;
  status: string;
  author: { discordId: string };
  votes: VoteOption[];
}

export default function EditCfipPage({ cfip }: { cfip: CfipData | null }) {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  
  const [title, setTitle] = useState(cfip?.title || '');
  const [description, setDescription] = useState(cfip?.description || '');
  const [options, setOptions] = useState<VoteOption[]>(
    cfip?.votes || [{ title: '', description: '' }, { title: '', description: '' }]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auth check
  const isAuthor = session?.user && (session.user as any).discordId === cfip?.author?.discordId;
  const canEdit = isAuthor && (cfip?.status === 'discussion' || cfip?.status === 'draft');

  if (authStatus === 'loading') {
    return (
      <main className="p-4 md:p-10 mx-auto max-w-3xl">
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
          <Text className="text-[var(--text-secondary)] text-center py-8">Loading...</Text>
        </Card>
      </main>
    );
  }

  if (!cfip) {
    return (
      <main className="p-4 md:p-10 mx-auto max-w-3xl">
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
          <Title className="text-[var(--text-heading)]">cFIP Not Found</Title>
          <Link href="/cfip">
            <Button color="gray" className="mt-4">Back to Proposals</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (!canEdit) {
    return (
      <main className="p-4 md:p-10 mx-auto max-w-3xl">
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
          <Title className="text-[var(--text-heading)]">Cannot Edit</Title>
          <Text className="text-[var(--text-secondary)] mt-2">
            {!isAuthor 
              ? 'Only the author can edit this proposal.'
              : 'This proposal can no longer be edited.'}
          </Text>
          <Link href={`/cfip/${cfip.id}`}>
            <Button color="gray" className="mt-4">Back to Proposal</Button>
          </Link>
        </Card>
      </main>
    );
  }

  const addOption = () => {
    if (options.length < 8) {
      setOptions([...options, { title: '', description: '' }]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, field: 'title' | 'description', value: string) => {
    const newOptions = [...options];
    newOptions[index][field] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/cfip/${cfip.id}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, options })
      });

      const data = await res.json();
      if (res.ok) {
        router.push(`/cfip/${cfip.id}`);
      } else {
        setError(data.error || 'Failed to update cFIP');
      }
    } catch (err) {
      setError('Failed to update cFIP');
    }

    setSubmitting(false);
  };

  return (
    <main className="p-4 md:p-10 mx-auto max-w-3xl">
      <Link href={`/cfip/${cfip.id}`}>
        <Button color="gray" variant="light" icon={RiArrowLeftLine} className="mb-4">
          Back to Proposal
        </Button>
      </Link>

      <Title className="text-[var(--text-heading)] mb-6">Edit Proposal</Title>

      {error && (
        <Callout title="Error" color="rose" className="mb-4">{error}</Callout>
      )}

      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Title (min 10 characters)
              </label>
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a clear, descriptive title"
                className="bg-[var(--bg-secondary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Description (min 50 characters, Markdown supported)
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your proposal in detail."
                rows={8}
                className="bg-[var(--bg-secondary)]"
              />
            </div>

            <div>
              <Flex justifyContent="between" alignItems="center" className="mb-2">
                <label className="block text-sm font-medium text-[var(--text-primary)]">
                  Voting Options (2-8)
                </label>
                <Button 
                  type="button" 
                  size="xs" 
                  color="gray" 
                  onClick={addOption}
                  disabled={options.length >= 8}
                  icon={RiAddLine}
                >
                  Add Option
                </Button>
              </Flex>
              
              <div className="space-y-3">
                {options.map((option, index) => (
                  <Card key={index} className="bg-[var(--bg-secondary)] p-3">
                    <Flex justifyContent="between" alignItems="center" className="mb-2">
                      <Text className="text-[var(--text-secondary)] text-sm">Option {index + 1}</Text>
                      {options.length > 2 && (
                        <Button 
                          type="button" 
                          size="xs" 
                          color="rose" 
                          variant="light"
                          onClick={() => removeOption(index)}
                          icon={RiDeleteBinLine}
                        />
                      )}
                    </Flex>
                    <TextInput
                      value={option.title}
                      onChange={(e) => updateOption(index, 'title', e.target.value)}
                      placeholder="Option title"
                      className="mb-2 bg-[var(--bg-card)]"
                    />
                    <TextInput
                      value={option.description}
                      onChange={(e) => updateOption(index, 'description', e.target.value)}
                      placeholder="Option description (optional)"
                      className="bg-[var(--bg-card)]"
                    />
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <Flex className="gap-3 mt-6">
            <Button
              type="submit"
              color="rose"
              disabled={
                title.length < 10 ||
                description.length < 50 ||
                !options.every(o => o.title.trim()) ||
                submitting
              }
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
            <Link href={`/cfip/${cfip.id}`}>
              <Button type="button" color="gray">Cancel</Button>
            </Link>
          </Flex>
        </form>
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

    return {
      props: {
        cfip: {
          id: cfip._id.toString(),
          title: cfip.title,
          description: cfip.description,
          status: cfip.status || 'discussion',
          author: cfip.author || { discordId: '' },
          votes: cfip.votes?.map((v: any) => ({
            title: v.title || '',
            description: v.description || ''
          })) || []
        }
      }
    };
  } catch (error) {
    console.error('Failed to fetch cFIP:', error);
    return { props: { cfip: null } };
  }
}
