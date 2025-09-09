import {
  Button,
  Card,
  Divider,
  Flex,
  Icon,
  ProgressBar,
  Title
} from '@tremor/react';
import { Vote } from '../lib/vote-schema';
import clientPromise from '../lib/mongoclient';
import { useState } from 'react';
import ModalVote from '../components/vote';
import { Dialog } from '@tremor/react';
import { useWallet } from '@txnlab/use-wallet';
import marked from 'marked';
import DOMPurify from 'dompurify';
import { EyeSlashIcon } from '@heroicons/react/24/outline';
import { Price } from '../lib/price-schema';
import axios from 'axios';

const colors = ['green', 'blue', 'yellow', 'pink', 'purple'] as const;
export default function VotePage({
  vote_data,
  price,
  priceValue
}: {
  vote_data: Vote[] | null;
  price: Price | null;
  priceValue: number;
}) {
  const { providers, activeAccount } = useWallet();
  const [openModalId, setOpenModalId] = useState<null | string>(null);

  const handleCloseModal = (index: number) => {
    setOpenModalId(null);
  };

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      {vote_data && vote_data.length > 0 ? (
        vote_data.map((vote, voteIdx) => {
          const totalVotes = vote?.votes.reduce(
            (acc, vote) => acc + vote.votes,
            0
          );
          return (
            <Flex
              flexDirection="col"
              justifyContent="center"
              alignItems="center"
              className="mb-8"
            >
              <Title>{vote.title}</Title>
              <div
                className="markdown-content mb-3"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(vote.description)
                }}
              />
              Will be closed on {new Date(vote.end_date).toLocaleString()} UTC
              {vote.super_majority && (
                <p className="font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  This vote requires a super majority: in order to pass, one
                  option should receive more than half the votes
                </p>
              )}
              <Divider />
              <Flex
                flexDirection="row"
                justifyContent="center"
                alignItems="center"
                className="mt-5"
              >
                <Icon
                  icon={EyeSlashIcon}
                  size="xl"
                  tooltip="Votes are currently hidden and will be revealed at the end of the FIP"
                ></Icon>
                <Title>Hidden votes</Title>
              </Flex>
              <Flex className="grid grid-cols-2 gap-4">
                {activeAccount ? (
                  vote.votes.map((option, index) => {
                    const voteKey = `${voteIdx}-${index}`;
                    const percent = Math.round(
                      (option.votes / totalVotes!) * 100
                    );
                    return (
                      <Card key={index} className="mt-5">
                        <Flex
                          flexDirection="col"
                          justifyContent="center"
                          alignItems="center"
                        >
                          <Title>{option.title}</Title>
                          <div
                            className="markdown-content mb-3"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(option.description)
                            }}
                          />

                          {!vote.hidden && (
                            <Flex
                              flexDirection="row"
                              justifyContent="between"
                              alignItems="center"
                            >
                              <span>
                                {option.votes} votes &bull;{' '}
                                {percent ? percent : 0}%
                              </span>
                              <span>{totalVotes} votes in total</span>
                            </Flex>
                          )}
                          <ProgressBar
                            value={percent}
                            color={colors[index]}
                            className="mt-3"
                          />
                          <Button
                            className="mt-2"
                            color={colors[index]}
                            size="lg"
                            onClick={() => setOpenModalId(voteKey)}
                          >
                            Vote
                          </Button>
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
                        </Flex>
                      </Card>
                    );
                  })
                ) : (
                  <p style={{ marginTop: '15px' }}>
                    You need to connect your wallet to vote!
                  </p>
                )}
              </Flex>
            </Flex>
          );
        })
      ) : (
        <p>No active vote found</p>
      )}
    </main>
  );
}

const algoURL = 'https://api.vestigelabs.org/assets/price?asset_ids=0';
let currentFRYPrice = {
  lastFetched: 0,
  price: 0
};
let currentAlgoPrice = {
  lastFetched: 0,
  price: 0
};

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
      const price = parseFloat(response.data[0].price) * 2 / 10;
      currentFRYPrice.price = parseFloat(price.toFixed(6));
      currentFRYPrice.lastFetched = Date.now();
    }
    console.log(currentFRYPrice.price);

    return Number((price.price / currentFRYPrice.price).toFixed(2));
  } else {
    return price.price;
  }
}

export async function getServerSideProps(context: any) {
  const testMode = process.env.NEXT_PUBLIC_TEST === 'true' ? true : false;
  try {
    const client = await clientPromise;
    const db = client.db('main');

    const price = (
      await db.collection('prices').find({ project_name: 'Vote' }).toArray()
    )[0] as Price;

    const priceValue = await getPriceOfAsset(price);

    const votes = (await db
      .collection(testMode ? 'test-dao' : 'dao')
      .find({ current: true })
      .toArray()) as Vote[];

    console.log(priceValue);

    if (!votes || votes.length === 0) {
      return {
        props: {
          vote_data: [],
          price: price ? JSON.parse(JSON.stringify(price)) : null,
          priceValue: priceValue
        }
      };
    } else {
      const renderMarkdown = async (markdown: string) => {
        const rawHTML = marked.parse(markdown) as string;
        return rawHTML;
      };
      //

      const vote_data = await Promise.all(
        votes.map(async (vote) => {
          const vote_descriptions = await Promise.all(
            vote.votes.map(async (vote_option: any) => {
              return await renderMarkdown(vote_option.description);
            })
          );

          return {
            title: vote.title,
            description: await renderMarkdown(vote.description),
            super_majority: vote.super_majority,
            end_date: vote.end_date,
            hidden: vote.hidden,
            votes: vote.votes.map((vote_option) => {
              return {
                title: vote_option.title,
                description: vote_descriptions[vote.votes.indexOf(vote_option)],
                votes: vote.hidden ? 0 : vote_option.votes
              };
            })
          };
        })
      );

      return {
        props: {
          vote_data: JSON.parse(JSON.stringify(vote_data)),
          price: price ? JSON.parse(JSON.stringify(price)) : null,
          priceValue: priceValue
        }
      };
    }
  } catch (e) {
    console.error(e);
  }
}
