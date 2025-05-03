import { Callout, Flex } from '@tremor/react';
import clientPromise from '../lib/mongoclient';
import { Stake } from '../lib/stake-schema';
import { Vote } from '../lib/vote-schema';
import { useWallet } from '@txnlab/use-wallet';
import { useEffect, useState } from 'react';
import StakeItem from '../components/stake';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

export default function StakePage() {
  const { activeAccount } = useWallet();
  const [stakes, setStakes] = useState<Stake[] | undefined>(undefined);
  const [updateSuccess, setUpdateSuccess] = useState<{
    success: boolean;
    message: string;
  }>({ success: false, message: '' });

  useEffect(() => {
    const fetchStakes = async () => {
      if (activeAccount) {
        const response = await fetch('/api/get-stakes', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ address: activeAccount.address })
        });

        if (!response.ok) {
          setStakes(undefined);
          return;
        }

        const result = await response.json();
        setStakes(result.data);
      } else {
        setStakes(undefined);
      }
    };

    fetchStakes();
  }, [activeAccount]);

  function handleMessage(success: boolean, message: string) {
    setUpdateSuccess({ success: success, message: message });
    setTimeout(() => {
      setUpdateSuccess({ success: false, message: '' });
    }, 1_500);
  }

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      {updateSuccess.message != '' && updateSuccess.success != false && (
        <Callout
          className="mt-4 mb-4"
          title="Success"
          icon={CheckCircleIcon}
          color="teal"
        >
          {updateSuccess.message}
        </Callout>
      )}
      {updateSuccess.message != '' && updateSuccess.success == false && (
        <Callout
          className="mt-4 mb-4"
          title="Error"
          icon={CheckCircleIcon}
          color="red"
        >
          {updateSuccess.message}
        </Callout>
      )}
      {activeAccount ? (
        <Flex flexDirection="col" className="w-full gap-2">
          {stakes &&
            stakes.map((stake) => {
              return <StakeItem stake={stake} handleMessage={handleMessage} />;
            })}
        </Flex>
      ) : (
        <p style={{ marginTop: '15px' }}>
          You need to connect your wallet to vote!
        </p>
      )}
    </main>
  );
}
