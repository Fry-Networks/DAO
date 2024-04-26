import { Button, Card, Divider, Flex, ProgressBar, Title } from '@tremor/react';
import { Vote } from '../lib/vote-schema';
import clientPromise from '../lib/mongoclient';
import { useState } from 'react';
import ModalVote from '../components/vote';
import { Dialog } from '@tremor/react';
import { useWallet } from '@txnlab/use-wallet';
import { BarList } from '@tremor/react';
const colors = ["green", "blue", "yellow", "pink", "purple"] as const;
export default function LastVotePage({ vote_data }: { vote_data: Vote | null }) {
    const totalVotes = vote_data?.votes.reduce((acc, vote) => acc + vote.votes, 0);
    const winnerVote = vote_data?.votes.reduce((prev, current) => (prev.votes > current.votes) ? prev : current);
    return (
        <main className="p-4 md:p-10 mx-auto max-w-7xl">
            {vote_data !== null ? (
                <Flex flexDirection='col' justifyContent='center' alignItems='center'>

                    <Title>{vote_data.title}</Title>
                    <p className="mb-10">{vote_data.description}</p>
                    <Divider />
                    <Flex className="grid grid-cols-2 gap-4">

                        {vote_data.votes.map((vote, index) => {
                            const percent = Math.round(((vote.votes / totalVotes!) * 100));
                            return (
                                <Card key={index} className={vote.title === winnerVote?.title ? 'mt-5 border-4' : 'mt-5'} decorationColor={vote.title === winnerVote?.title ? 'green' : 'gray'}>
                                    <Flex flexDirection='col' justifyContent='center' alignItems='center'>
                                        <Title>{vote.title}</Title>
                                        <p>{vote.description}</p>

                                        <Flex flexDirection='row' justifyContent='between' alignItems='center'>
                                            <span>{vote.votes} votes &bull; {percent}%</span>
                                            <span>{totalVotes} votes in total</span>
                                        </Flex>

                                        <ProgressBar value={percent} color={colors[index]} className="mt-3" />
                                    </Flex>
                                </Card>
                            )
                        })}
                    </Flex>

                </Flex>
            ) : <p>No vote found</p>}
        </main>
    );
}

export async function getServerSideProps(context: any) {
    try {
        const client = await clientPromise;
        const db = client.db('main');

        const vote = (await db.collection('dao').find({ current: false, deleted: false, hadVotes: true }).sort({ createdAt: -1 }).limit(1).toArray())[0]
        if (!vote) {
            return {
                props: { vote_data: null }
            }
        }
        const data = {
            title: vote.title,
            description: vote.description,
            votes: vote.votes.map((vote: any) => {
                return {
                    title: vote.title,
                    description: vote.description,
                    votes: vote.votes
                }
            }
            )
        }
        return {
            props: { vote_data: data }
        };
    } catch (e) {
        console.error(e);
    }
}
