import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Button,
  Card,
  Divider,
  Flex,
  Icon,
  ProgressBar,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Title,
  Text
} from '@tremor/react';
import { Vote } from '../lib/vote-schema';
import { Price } from '../lib/price-schema';
import clientPromise from '../lib/mongoclient';
import ModalVote from '../components/vote';
import CastVoteModal from '../components/cast-vote-modal';
import { useWallet } from '../lib/use-wallet-compat';
import { marked } from 'marked';
import { sanitizeHtml } from '../lib/sanitize-html';
import { EyeSlashIcon } from '@heroicons/react/24/outline';
import { RiCheckboxCircleFill } from '@remixicon/react';
import axios from 'axios';

const colors = ['emerald', 'rose', 'amber', 'violet', 'sky'] as const;

interface ActiveVote {
  title: string;
  description: string;
  super_majority: boolean;
  end_date: string;
  hidden: boolean;
  contractVoteId?: string;
  votes: {
    title: string;
    description: string;
    votes: number;
  }[];
}

interface HistoricalVote {
  title: string;
  description: string;
  createdAt: string;
  super_majority: boolean;
  end_date: string;
  all_people_number: number;
  votes: {
    title: string;
    description: string;
    votes: number;
    different_people: number;
  }[];
}

interface VotesPageProps {
  activeVotes: ActiveVote[];
  recentVote: HistoricalVote | null;
  allVotes: HistoricalVote[];
  price: Price | null;
  priceValue: number;
}

export default function VotesPage({ activeVotes, recentVote, allVotes, price, priceValue }: VotesPageProps) {
  const router = useRouter();
  const { providers, activeAccount } = useWallet();
  const [openModalId, setOpenModalId] = useState<null | string>(null);
  const [expandedVotes, setExpandedVotes] = useState<boolean[]>(
    Array(allVotes?.length).fill(false)
  );

  // Determine initial tab from URL query
  const tabMap: Record<string, number> = { active: 0, recent: 1, all: 2 };
  const tabFromQuery = router.query.tab as string;
  const defaultTab = activeVotes.length > 0 ? 0 : (recentVote ? 1 : 2);
  const initialTab = tabMap[tabFromQuery] ?? defaultTab;
  
  const [tabIndex, setTabIndex] = useState(initialTab);

  // Sync tab with URL on mount/query change
  useEffect(() => {
    if (tabFromQuery && tabMap[tabFromQuery] !== undefined) {
      setTabIndex(tabMap[tabFromQuery]);
    }
  }, [tabFromQuery]);

  const handleTabChange = (index: number) => {
    setTabIndex(index);
    const tabNames = ['active', 'recent', 'all'];
    router.replace(`/votes?tab=${tabNames[index]}`, undefined, { shallow: true });
  };

  const handleCloseModal = () => {
    setOpenModalId(null);
  };

  const toggleVoteDetails = (index: number) => {
    setExpandedVotes((prev) => {
      const newState = [...prev];
      newState[index] = !newState[index];
      return newState;
    });
  };

  // Helper for winner calculation
  const getWinner = (vote: HistoricalVote) => {
    const totalVotes = vote.votes.reduce((acc, v) => acc + v.votes, 0);
    const hasWinner = vote.super_majority
      ? vote.votes.some((v) => v.votes > totalVotes / 2)
      : !vote.votes.some((v1, i1) =>
          vote.votes.some((v2, i2) => i1 !== i2 && v1.votes === v2.votes)
        );
    const winnerVote = vote.votes.reduce((prev, current) =>
      prev.votes > current.votes ? prev : current
    );
    return { totalVotes, hasWinner, winnerVote };
  };

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      <Title className="text-[var(--text-heading)] mb-6">Votes</Title>

      <TabGroup index={tabIndex} onIndexChange={handleTabChange}>
        <TabList variant="solid" className="mb-6">
          <Tab>Active{activeVotes.length > 0 && ` (${activeVotes.length})`}</Tab>
          <Tab>Recent</Tab>
          <Tab>All ({allVotes.length})</Tab>
        </TabList>

        <TabPanels>
          {/* ACTIVE TAB */}
          <TabPanel>
            {activeVotes && activeVotes.length > 0 ? (
              activeVotes.map((vote, voteIdx) => {
                const totalVotes = vote.votes.reduce((acc, v) => acc + v.votes, 0);
                return (
                  <Flex
                    key={voteIdx}
                    flexDirection="col"
                    justifyContent="center"
                    alignItems="center"
                    className="mb-8"
                  >
                    <Title className="text-[var(--text-heading)]">{vote.title}</Title>
                    <div
                      className="markdown-content mb-3 text-[var(--text-primary)]"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(vote.description) }}
                    />
                    <span className="text-[var(--text-secondary)]">
                      Will be closed on {new Date(vote.end_date).toLocaleString()} UTC
                    </span>
                    {vote.super_majority && (
                      <p className="font-bold text-[var(--text-primary)] mt-2">
                        This vote requires a super majority: in order to pass, one option should receive more than half the votes
                      </p>
                    )}
                    <Divider />
                    {vote.hidden && (
                      <Flex flexDirection="row" justifyContent="center" alignItems="center" className="mt-5">
                        <Icon icon={EyeSlashIcon} size="xl" color="slate" tooltip="Votes are currently hidden and will be revealed at the end of the FIP" />
                        <Title className="text-[var(--text-secondary)]">Hidden votes</Title>
                      </Flex>
                    )}
                    <Flex className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      {activeAccount ? (
                        vote.votes.map((option, index) => {
                          const voteKey = `${voteIdx}-${index}`;
                          const percent = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                          return (
                            <Card key={index} className="mt-5 bg-[var(--bg-card)] border border-[var(--border-color)]">
                              <Flex flexDirection="col" justifyContent="center" alignItems="center">
                                <Title className="text-[var(--text-heading)]">{option.title}</Title>
                                <div
                                  className="markdown-content mb-3 text-[var(--text-primary)]"
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(option.description) }}
                                />
                                {!vote.hidden && (
                                  <Flex flexDirection="row" justifyContent="between" alignItems="center" className="w-full text-[var(--text-secondary)]">
                                    <span>{option.votes} votes &bull; {percent}%</span>
                                    <span>{totalVotes} votes in total</span>
                                  </Flex>
                                )}
                                <ProgressBar value={percent} color={colors[index % colors.length]} className="mt-3" />
                                <Button className="mt-2" color={colors[index % colors.length]} size="lg" onClick={() => setOpenModalId(voteKey)}>
                                  Vote
                                </Button>
                                {vote.contractVoteId ? (
                                  <CastVoteModal
                                    key={`contract-${index}`}
                                    isOpen={openModalId === voteKey}
                                    setIsOpen={(open: boolean) => !open && handleCloseModal()}
                                    vote={{
                                      contractVoteId: vote.contractVoteId,
                                      title: vote.title,
                                      description: option.description,
                                      optionTitle: option.title,
                                      optionIndex: index
                                    }}
                                    onSuccess={() => window.location.reload()}
                                  />
                                ) : (
                                  <ModalVote
                                    key={index}
                                    isOpen={openModalId === voteKey}
                                    setIsOpen={handleCloseModal}
                                    vote={{
                                      vote_index: voteIdx,
                                      index: index,
                                      title: vote.title,
                                      description: option.description,
                                      optionTitle: option.title
                                    }}
                                    price={price}
                                    priceValue={priceValue}
                                  />
                                )}
                              </Flex>
                            </Card>
                          );
                        })
                      ) : (
                        <p className="text-[var(--text-secondary)] mt-4 col-span-2 text-center">
                          You need to connect your wallet to vote!
                        </p>
                      )}
                    </Flex>
                  </Flex>
                );
              })
            ) : (
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
                <Text className="text-[var(--text-secondary)] text-center py-8">
                  No active votes at the moment. Check the Recent or All tabs for past votes.
                </Text>
              </Card>
            )}
          </TabPanel>

          {/* RECENT TAB */}
          <TabPanel>
            {recentVote ? (
              <Flex flexDirection="col" justifyContent="center" alignItems="center">
                <Title className="text-[var(--text-heading)]">{recentVote.title}</Title>
                <div
                  className="markdown-content mb-3 text-[var(--text-primary)]"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(recentVote.description) }}
                />
                <span className="text-[var(--text-secondary)]">
                  Started on {new Date(recentVote.createdAt).toLocaleString()} UTC
                </span>
                <span className="text-[var(--text-secondary)]">
                  Closed on {new Date(recentVote.end_date).toLocaleString()} UTC
                </span>
                <Divider />
                {recentVote.super_majority && (
                  <p className="text-lg font-bold text-rose-400">
                    This vote required a super majority: no option passes!
                  </p>
                )}
                {(() => {
                  const { totalVotes, hasWinner, winnerVote } = getWinner(recentVote);
                  return (
                    <Flex className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      {recentVote.votes.map((vote, index) => {
                        const percent = totalVotes > 0 ? Math.round((vote.votes / totalVotes) * 100) : 0;
                        return (
                          <Card
                            key={index}
                            className={
                              vote.title === winnerVote?.title && hasWinner
                                ? 'mt-5 border-4 border-emerald-500 bg-[var(--bg-card)]'
                                : 'mt-5 bg-[var(--bg-card)] border border-[var(--border-color)]'
                            }
                            decorationColor={vote.title === winnerVote?.title && hasWinner ? 'emerald' : 'slate'}
                          >
                            <Flex flexDirection="col" justifyContent="center" alignItems="center">
                              <Title className="text-[var(--text-heading)]">{vote.title}</Title>
                              <div
                                className="markdown-content mb-3 text-[var(--text-primary)]"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(vote.description) }}
                              />
                              <Flex flexDirection="row" justifyContent="between" alignItems="center" className="w-full text-[var(--text-secondary)]">
                                <span>{vote.votes} votes &bull; {percent}%</span>
                                <span>{totalVotes} votes in total</span>
                              </Flex>
                              <Flex flexDirection="row" justifyContent="between" alignItems="center" className="w-full text-[var(--text-secondary)]">
                                <span>{vote.different_people} wallets</span>
                                <span>{recentVote.all_people_number} wallets in total</span>
                              </Flex>
                              <ProgressBar value={percent} color={colors[index % colors.length]} className="mt-3" />
                            </Flex>
                          </Card>
                        );
                      })}
                    </Flex>
                  );
                })()}
              </Flex>
            ) : (
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
                <Text className="text-[var(--text-secondary)] text-center py-8">No recent vote found.</Text>
              </Card>
            )}
          </TabPanel>

          {/* ALL TAB */}
          <TabPanel>
            {allVotes && allVotes.length > 0 ? (
              <div className="flex flex-col gap-6">
                {allVotes.map((vote_data, voteIndex) => {
                  const { totalVotes, hasWinner, winnerVote } = getWinner(vote_data);
                  return (
                    <section
                      key={voteIndex}
                      className="border border-[var(--border-color)] p-4 rounded-lg w-full bg-[var(--bg-card)]"
                    >
                      <Button
                        onClick={() => toggleVoteDetails(voteIndex)}
                        className="w-full bg-[var(--bg-secondary)] text-[var(--text-heading)] hover:bg-[var(--border-color)] border border-[var(--border-color)]"
                      >
                        <Flex flexDirection="col" justifyContent="between" alignItems="center" className="w-full">
                          <Title className="text-[var(--text-heading)] w-full text-center break-words whitespace-normal">
                            {vote_data.title}
                          </Title>
                          <Flex flexDirection="row" justifyContent="center" alignItems="center" className="w-full">
                            <RiCheckboxCircleFill className="ml-2" color="#4ade80" />
                            <Title className="text-[var(--text-heading)] break-words whitespace-normal">
                              {' '}Winner: {winnerVote?.title}
                            </Title>
                          </Flex>
                        </Flex>
                      </Button>
                      <div
                        className={`transition-max-height duration-500 ease-in-out ${expandedVotes[voteIndex] ? 'max-h-[600px] overflow-auto' : 'max-h-0 overflow-hidden'}`}
                      >
                        <Flex flexDirection="col" justifyContent="center" alignItems="center" className="w-full mt-4">
                          <div
                            className="markdown-content mb-3 text-[var(--text-primary)]"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(vote_data.description) }}
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
                              const percent = totalVotes > 0 ? Math.round((vote.votes / totalVotes) * 100) : 0;
                              return (
                                <Card
                                  key={index}
                                  className={`mt-5 w-full border bg-[var(--bg-secondary)] ${vote.title === winnerVote?.title && hasWinner ? 'border-4 border-emerald-500' : 'border-[var(--border-color)]'}`}
                                  decorationColor={vote.title === winnerVote?.title && hasWinner ? 'emerald' : 'slate'}
                                >
                                  <Flex flexDirection="col" justifyContent="center" alignItems="center" className="w-full">
                                    <Title className="w-full text-center text-[var(--text-heading)]">{vote.title}</Title>
                                    <div
                                      className="markdown-content mb-3 text-[var(--text-primary)]"
                                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(vote.description) }}
                                    />
                                    <Flex flexDirection="row" justifyContent="between" alignItems="center" className="w-full text-[var(--text-secondary)]">
                                      <span>{vote.votes} votes &bull; {percent}%</span>
                                      <span>{totalVotes} votes in total</span>
                                    </Flex>
                                    <Flex flexDirection="row" justifyContent="between" alignItems="center" className="w-full text-[var(--text-secondary)]">
                                      <span>{vote.different_people} wallets</span>
                                      <span>{vote_data.all_people_number} wallets in total</span>
                                    </Flex>
                                    <ProgressBar value={percent} color={colors[index % colors.length]} className="mt-3 w-full" />
                                  </Flex>
                                </Card>
                              );
                            })}
                          </Flex>
                        </Flex>
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
                <Text className="text-[var(--text-secondary)] text-center py-8">No votes found.</Text>
              </Card>
            )}
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </main>
  );
}

// Price fetching helper (from vote.tsx)
const algoURL = 'https://api.vestigelabs.org/assets/price?asset_ids=0';
let currentFRYPrice = { lastFetched: 0, price: 0 };

async function getPriceOfAsset(price: Price) {
  if (price && price.isUSD) {
    const FRYVerID = price?.asset_id ?? 2485314946;
    const fryURL = `https://api.vestigelabs.org/assets/price?asset_ids=${FRYVerID}`;
    if (Date.now() - currentFRYPrice.lastFetched > 1000 * 60 * 1) {
      const response = await axios.get(fryURL);
      if (!response.data || response.data.length === 0) {
        console.error("Failed to fetch FRY price data");
        return currentFRYPrice.price;
      }
      const priceVal = parseFloat(response.data[0].price) * 2 / 10;
      currentFRYPrice.price = parseFloat(priceVal.toFixed(6));
      currentFRYPrice.lastFetched = Date.now();
    }
    return Number((price.price / currentFRYPrice.price).toFixed(2));
  } else {
    return price.price;
  }
}

export async function getServerSideProps(context: any) {
  const testMode = process.env.NEXT_PUBLIC_TEST === 'true';
  const collectionName = testMode ? 'test-dao' : 'dao';

  try {
    const client = await clientPromise();
    const db = client.db('main');

    // Fetch price data
    const price = (await db.collection('prices').find({ project_name: 'Vote' }).toArray())[0] as Price;
    const priceValue = price ? await getPriceOfAsset(price) : 0;

    // Render markdown helper
    const renderMarkdown = async (markdown: string) => {
      return marked.parse(markdown) as string;
    };

    // 1. Active votes (current: true)
    const activeVotesRaw = await db.collection(collectionName).find({ current: true }).toArray() as Vote[];
    const activeVotes = await Promise.all(
      activeVotesRaw.map(async (vote) => ({
        title: vote.title,
        description: await renderMarkdown(vote.description),
        super_majority: vote.super_majority,
        end_date: vote.end_date,
        hidden: vote.hidden,
        contractVoteId: vote.contractVoteId,
        votes: await Promise.all(
          vote.votes.map(async (opt: any) => ({
            title: opt.title,
            description: await renderMarkdown(opt.description),
            votes: vote.hidden ? 0 : opt.votes
          }))
        )
      }))
    );

    // 2. Recent vote (most recent closed)
    const recentVoteRaw = await db.collection(collectionName)
      .find({ current: false, deleted: { $ne: true }, hadVotes: true })
      .sort({ end_date: -1 })
      .limit(1)
      .toArray();
    
    let recentVote = null;
    if (recentVoteRaw.length > 0) {
      const rv = recentVoteRaw[0] as Vote;
      const all_people_number = rv.votes.reduce(
        (total: number, v: any) => total + (v.different_people?.length || 0), 0
      );
      recentVote = {
        title: rv.title,
        description: await renderMarkdown(rv.description),
        createdAt: rv.createdAt,
        super_majority: rv.super_majority,
        end_date: rv.end_date,
        all_people_number,
        votes: await Promise.all(
          rv.votes.map(async (opt: any) => ({
            title: opt.title,
            description: await renderMarkdown(opt.description),
            votes: opt.votes,
            different_people: opt.different_people?.length || 0
          }))
        )
      };
    }

    // 3. All historical votes
    const allVotesRaw = await db.collection(collectionName)
      .find({ current: false, deleted: { $ne: true }, hadVotes: true })
      .sort({ end_date: -1 })
      .toArray() as Vote[];

    const allVotes = await Promise.all(
      allVotesRaw.map(async (vote) => {
        const all_people_number = vote.votes.reduce(
          (total: number, v: any) => total + (v.different_people?.length || 0), 0
        );
        return {
          title: vote.title,
          description: await renderMarkdown(vote.description),
          createdAt: vote.createdAt,
          super_majority: vote.super_majority,
          end_date: vote.end_date,
          all_people_number,
          votes: await Promise.all(
            vote.votes.map(async (opt: any) => ({
              title: opt.title,
              description: await renderMarkdown(opt.description),
              votes: opt.votes,
              different_people: opt.different_people?.length || 0
            }))
          )
        };
      })
    );

    return {
      props: {
        activeVotes: JSON.parse(JSON.stringify(activeVotes)),
        recentVote: recentVote ? JSON.parse(JSON.stringify(recentVote)) : null,
        allVotes: JSON.parse(JSON.stringify(allVotes)),
        price: price ? JSON.parse(JSON.stringify(price)) : null,
        priceValue
      }
    };
  } catch (e) {
    console.error(e);
    return {
      props: {
        activeVotes: [],
        recentVote: null,
        allVotes: [],
        price: null,
        priceValue: 0
      }
    };
  }
}
