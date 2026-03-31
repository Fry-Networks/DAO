import { Card, Divider, Flex, ProgressBar, Title } from '@tremor/react';
import { Vote } from '../lib/vote-schema';
import clientPromise from '../lib/mongoclient';
import { marked } from 'marked';
import { sanitizeHtml } from '../lib/sanitize-html';

const colors = ['emerald', 'rose', 'amber', 'violet', 'sky'] as const;

export default function LastVotePage({
  vote_data
}: {
  vote_data: Vote | null;
}) {
  const totalVotes = vote_data?.votes.reduce(
    (acc, vote) => acc + vote.votes,
    0
  );
  const hasWinner = vote_data?.super_majority
    ? vote_data?.votes.some((vote) => vote.votes > totalVotes! / 2)
    : !vote_data?.votes.some((vote1, index1) => {
        return vote_data.votes.some((vote2, index2) => {
          return index1 !== index2 && vote1.votes === vote2.votes;
        });
      });
  const winnerVote = vote_data?.votes.reduce((prev, current) =>
    prev.votes > current.votes ? prev : current
  );

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      {vote_data !== null ? (
        <Flex flexDirection="col" justifyContent="center" alignItems="center">
          <Title className="text-[var(--text-heading)]">{vote_data.title}</Title>
          <div
            className="markdown-content mb-3 text-[var(--text-primary)]"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(vote_data.description)
            }}
          />
          <span className="text-[var(--text-secondary)]">
            Started on {new Date(vote_data.createdAt).toLocaleString()} UTC
          </span>
          <span className="text-[var(--text-secondary)]">
            Closed on {new Date(vote_data.end_date).toLocaleString()} UTC
          </span>

          <Divider />
          {vote_data.super_majority && (
            <p className="text-lg font-bold text-rose-400">
              This vote required a super majority: no option passes!
            </p>
          )}
          <Flex className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {vote_data.votes.map((vote, index) => {
              const percent = Math.round((vote.votes / totalVotes!) * 100);
              return (
                <Card
                  key={index}
                  className={
                    vote.title === winnerVote?.title && hasWinner
                      ? 'mt-5 border-4 border-emerald-500 bg-[var(--bg-card)]'
                      : 'mt-5 bg-[var(--bg-card)] border border-[var(--border-color)]'
                  }
                  decorationColor={
                    vote.title === winnerVote?.title && hasWinner
                      ? 'emerald'
                      : 'slate'
                  }
                >
                  <Flex
                    flexDirection="col"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Title className="text-[var(--text-heading)]">{vote.title}</Title>
                    <div
                      className="markdown-content mb-3 text-[var(--text-primary)]"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(vote.description)
                      }}
                    />

                    <Flex
                      flexDirection="row"
                      justifyContent="between"
                      alignItems="center"
                      className="w-full text-[var(--text-secondary)]"
                    >
                      <span>
                        {vote.votes} votes &bull; {percent ? percent : 0}%
                      </span>
                      <span>{totalVotes} votes in total</span>
                    </Flex>
                    <Flex
                      flexDirection="row"
                      justifyContent="between"
                      alignItems="center"
                      className="w-full text-[var(--text-secondary)]"
                    >
                      <span>{vote.different_people} wallets</span>
                      {/*@ts-ignore*/}
                      <span>
                        {vote_data.all_people_number} wallets in total
                      </span>
                    </Flex>

                    <ProgressBar
                      value={percent}
                      color={colors[index]}
                      className="mt-3"
                    />
                  </Flex>
                </Card>
              );
            })}
          </Flex>
        </Flex>
      ) : (
        <p className="text-[var(--text-secondary)]">No vote found</p>
      )}
    </main>
  );
}

export async function getServerSideProps(context: any) {
  const testMode = process.env.NEXT_PUBLIC_TEST === 'true' ? true : false;
  try {
    const client = await clientPromise();
    const db = client.db('main');

    const vote = (
      await db
        .collection(testMode ? 'test-dao' : 'dao')
        .find({
          current: false,
          deleted: {
            $ne: true
          },
          hadVotes: true
        })
        .sort({ end_date: -1 })
        .limit(1)
        .toArray()
    )[0] as Vote;
    if (!vote) {
      return {
        props: { vote_data: null }
      };
    }

    const renderMarkdown = async (markdown: string) => {
      const rawHTML = (await marked.parse(markdown)) as string;
      return rawHTML;
    };

    const all_people_number = vote.votes.reduce(
      (total: any, vote: { different_people: string | any[] }) =>
        total + vote.different_people.length,
      0
    );
    const vote_descriptions = await Promise.all(
      vote.votes.map(async (vote_option: any) => {
        return await renderMarkdown(vote_option.description);
      })
    );
    const data = {
      title: vote.title,
      description: await renderMarkdown(vote.description),
      createdAt: vote.createdAt,
      super_majority: vote.super_majority,
      end_date: vote.end_date,
      all_people_number: all_people_number,
      votes: vote.votes.map((vote_option) => {
        return {
          title: vote_option.title,
          description: vote_descriptions[vote.votes.indexOf(vote_option)],
          votes: vote_option.votes,
          different_people: vote_option.different_people.length
        };
      })
    };
    return {
      props: { vote_data: JSON.parse(JSON.stringify(data)) }
    };
  } catch (e) {
    console.error(e);
    return {
      props: {
        vote_data: null
      }
    };
  }
}
