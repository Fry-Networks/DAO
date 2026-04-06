import { Button, Divider, Flex, Text, Title } from '@tremor/react';
import { useEffect, useState } from 'react';
import { hasUserVotedOfficial, getOfficialVoteStatus } from '../lib/governance-client';
import WithdrawModal from './withdraw-modal';

interface V2Vote {
  _id: string;
  title: string;
  contractVoteId: string;
  end_date: string;
}

interface StakeInfo {
  optionIndex: number;
  tokenAmount: bigint;
  withdrawn: boolean;
}

interface ContractStakeProps {
  vote: V2Vote;
  walletAddress: string;
  onWithdraw?: () => void;
}

export default function ContractStakeItem({ vote, walletAddress, onWithdraw }: ContractStakeProps) {
  const [stakeInfo, setStakeInfo] = useState<StakeInfo | null>(null);
  const [lockEndsAt, setLockEndsAt] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Convert hex contractVoteId to Uint8Array
  const hexToBytes = (hex: string): Uint8Array => {
    return new Uint8Array((hex.match(/.{1,2}/g) || []).map(b => parseInt(b, 16)));
  };

  useEffect(() => {
    async function fetchStake() {
      if (!walletAddress || !vote.contractVoteId) {
        setLoading(false);
        return;
      }

      try {
        const voteId = hexToBytes(vote.contractVoteId);
        
        // Check if user has a stake
        const stake = await hasUserVotedOfficial(voteId, walletAddress);
        if (!stake) {
          setLoading(false);
          return;
        }

        // Get vote status for lock duration
        const voteStatus = await getOfficialVoteStatus(voteId);
        if (!voteStatus) {
          setLoading(false);
          return;
        }

        setStakeInfo(stake);
        setLockEndsAt(voteStatus.endDate + voteStatus.lockDuration);
      } catch (err) {
        console.error('Error fetching contract stake:', err);
      }
      setLoading(false);
    }

    fetchStake();
  }, [vote.contractVoteId, walletAddress]);

  // Update time left display
  useEffect(() => {
    if (!lockEndsAt || stakeInfo?.withdrawn) return;

    const updateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = lockEndsAt - now;
      if (diff <= 0) {
        setTimeLeft('Ready');
        return;
      }
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = Math.floor(diff % 60);
      
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${mins}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      } else {
        setTimeLeft(`${mins}m ${secs}s`);
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [lockEndsAt, stakeInfo?.withdrawn]);

  // Don't render if no stake or still loading
  if (loading) return null;
  if (!stakeInfo) return null;
  if (stakeInfo.withdrawn) return null;

  const fryAmount = Number(stakeInfo.tokenAmount) / 1_000_000;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const canWithdraw = nowSeconds >= lockEndsAt;

  return (
    <div className="w-full p-4 bg-[var(--bg-card)] border-emerald-600 border-2 rounded-2xl">
      <Title className="w-full text-[var(--text-heading)]">{vote.title}</Title>
      <Divider className="mt-1 mb-2" />
      <Text className="text-[var(--text-secondary)]">Option: {stakeInfo.optionIndex + 1}</Text>
      <Text className="mt-2 text-[var(--text-primary)]">
        Staked {fryAmount.toFixed(2)} FRY
      </Text>
      <Flex className="mt-4">
        {canWithdraw ? (
          <Text className="text-emerald-500">Ready to withdraw</Text>
        ) : (
          <Text className="text-amber-400">{timeLeft} left to withdraw</Text>
        )}
        <Button
          color="emerald"
          disabled={!canWithdraw}
          onClick={() => setShowModal(true)}
        >
          Withdraw
        </Button>
      </Flex>

      <WithdrawModal
        isOpen={showModal}
        setIsOpen={setShowModal}
        voteTitle={vote.title}
        contractVoteId={vote.contractVoteId}
        stakeInfo={stakeInfo}
        lockEndsAt={lockEndsAt}
        onSuccess={() => {
          setStakeInfo(prev => prev ? { ...prev, withdrawn: true } : null);
          onWithdraw?.();
        }}
      />
    </div>
  );
}
