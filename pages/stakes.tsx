import { Callout, Flex, Title } from '@tremor/react';
import { useWallet } from '../lib/use-wallet-compat';
import { useEffect, useState } from 'react';
import StakeItem from '../components/stake';
import ContractStakeItem from '../components/contract-stake';
import { Stake } from '../lib/stake-schema';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

interface V2Vote {
  _id: string;
  title: string;
  contractVoteId: string;
  end_date: string;
}

export default function StakePage() {
  const { activeAccount } = useWallet();
  const [stakes, setStakes] = useState<Stake[] | undefined>(undefined);
  const [v2Votes, setV2Votes] = useState<V2Vote[]>([]);
  const [updateSuccess, setUpdateSuccess] = useState<{
    success: boolean;
    message: string;
  }>({ success: false, message: '' });

  // Fetch V1 legacy stakes
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

  // Fetch V2 votes (contract-based)
  useEffect(() => {
    const fetchV2Votes = async () => {
      if (!activeAccount) {
        setV2Votes([]);
        return;
      }

      try {
        const response = await fetch('/api/get-v2-votes');
        if (response.ok) {
          const result = await response.json();
          setV2Votes(result.data || []);
        }
      } catch (err) {
        console.error('Error fetching V2 votes:', err);
      }
    };

    fetchV2Votes();
  }, [activeAccount]);

  function handleMessage(success: boolean, message: string) {
    setUpdateSuccess({ success: success, message: message });
    setTimeout(() => {
      setUpdateSuccess({ success: false, message: '' });
    }, 1_500);
  }

  const handleV2Withdraw = () => {
    handleMessage(true, 'Successfully withdrew FRY from contract');
  };

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      {updateSuccess.message != '' && updateSuccess.success != false && (
        <Callout
          className="mt-4 mb-4 bg-[var(--bg-card)] border-emerald-500"
          title="Success"
          icon={CheckCircleIcon}
          color="emerald"
        >
          {updateSuccess.message}
        </Callout>
      )}
      {updateSuccess.message != '' && updateSuccess.success == false && (
        <Callout
          className="mt-4 mb-4 bg-[var(--bg-card)] border-rose-500"
          title="Error"
          icon={CheckCircleIcon}
          color="rose"
        >
          {updateSuccess.message}
        </Callout>
      )}
      {activeAccount ? (
        <>
          {/* V2 Contract Stakes */}
          {v2Votes.length > 0 && (
            <Flex flexDirection="col" className="w-full gap-2 mb-6">
              {v2Votes.map((vote) => (
                <ContractStakeItem
                  key={vote._id}
                  vote={vote}
                  walletAddress={activeAccount.address}
                  onWithdraw={handleV2Withdraw}
                />
              ))}
            </Flex>
          )}

          {/* V1 Legacy Stakes */}
          <Flex flexDirection="col" className="w-full gap-2">
            {stakes &&
              stakes.map((stake, index) => {
                return <StakeItem key={index} stake={stake} handleMessage={handleMessage} />;
              })}
          </Flex>
        </>
      ) : (
        <p className="text-[var(--text-secondary)] mt-4">
          You need to connect your wallet to check staking information!
        </p>
      )}
    </main>
  );
}
