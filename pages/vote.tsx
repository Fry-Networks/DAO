import { Button, Card, Divider, Flex, ProgressBar, Title } from '@tremor/react';
import { Vote } from '../lib/vote-schema';
import clientPromise from '../lib/mongoclient';
import { useState } from 'react';
import ModalVote from '../components/vote';
import { Dialog } from '@tremor/react';
import { useWallet } from '@txnlab/use-wallet';
import { BarList } from '@tremor/react';
const colors = ["green", "blue", "yellow", "pink", "purple"] as const;
export default function VotePage({ vote_data }: { vote_data: Vote }) {
  const { providers, activeAccount } = useWallet()
  const [openModalId, setOpenModalId] = useState(null as number | null);
  const handleCloseModal = (index: number) => {
    setOpenModalId(null);
  }
  const totalVotes = vote_data.votes.reduce((acc, vote) => acc + vote.votes, 0);
  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      <Flex flexDirection='col' justifyContent='center' alignItems='center'>
        <Title>{vote_data.title}</Title>
        <p className="mb-10">{vote_data.description}</p>
        <Divider />
        <Flex className="grid grid-cols-2 gap-4">
          {
            activeAccount ?
              vote_data.votes.map((vote, index) => {
                const percent = Math.round(((vote.votes / totalVotes) * 100));
                return (
                  <Card key={index} className='mt-5'>
                    <Flex flexDirection='col' justifyContent='center' alignItems='center'>
                      <Title>{vote.title}</Title>
                      <p>{vote.description}</p>
     
                        <Flex flexDirection='row' justifyContent='between' alignItems='center'>
                        <span>{vote.votes} votes &bull; {percent}%</span>
                        <span>{totalVotes} votes in total</span>
                        </Flex>
                   
                      <ProgressBar value={percent} color="teal" className="mt-3" />
                      <Button className="mt-2" color={colors[index]} size='lg' onClick={() => setOpenModalId(index)}
                      >Vote</Button>
                      <ModalVote key={index} isOpen={openModalId === index}
                        setIsOpen={handleCloseModal} vote={{ index: index, title: vote.title, description: vote.description }} />
                    </Flex>
                  </Card>
                )
              }) : <p style={{ marginTop: "15px" }}>You need to connect your wallet to vote!</p>
          }
        </Flex>
      </Flex>
    </main>
  );
}

export async function getServerSideProps(context: any) {
  try {
    const client = await clientPromise;
    const db = client.db('main');

    const vote = (await db.collection('dao').find({ current: true }).toArray())[0]
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
