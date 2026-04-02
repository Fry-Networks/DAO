import { useState, useEffect } from 'react';
import { Button, Card, Callout, Flex, ProgressBar, Text, Title } from '@tremor/react';
import { RiCheckLine, RiCloseLine, RiTimeLine } from '@remixicon/react';
import algosdk from 'algosdk';
import { useWallet } from '../lib/use-wallet-compat';
import {
  buildCastTempVote,
  getAlgodClient,
  getTempCheckStatus,
  hasUserVoted,
  makeVoteId,
  STAKE_BOX_MBR
} from '../lib/governance-client';

interface TempCheckVoteProps {
  cfipId: string;
  onVoteSuccess?: () => void;
}

interface TempCheckData {
  endDate: number;
  yesVotes: number;
  noVotes: number;
  closed: boolean;
  userHasVoted: boolean;
}

export default function TempCheckVote({ cfipId, onVoteSuccess }: TempCheckVoteProps) {
  const { activeAddress, signTransactions } = useWallet();
  const [data, setData] = useState<TempCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const voteId = makeVoteId(`cfip-${cfipId}`);

  const fetchStatus = async () => {
    try {
      const algod = await getAlgodClient();
      const status = await getTempCheckStatus(algod, voteId);
      
      if (!status) {
        setData(null);
        return;
      }

      let userHasVoted = false;
      if (activeAddress) {
        userHasVoted = await hasUserVoted(algod, voteId, activeAddress);
      }

      setData({
        ...status,
        userHasVoted
      });
    } catch (err) {
      console.error('Failed to fetch temp check status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [cfipId, activeAddress]);

  const handleVote = async (optionIndex: number) => {
    if (!activeAddress) {
      setError('Please connect your wallet first');
      return;
    }

    setVoting(true);
    setError(null);
    setSuccess(null);

    try {
      // Check FRY balance eligibility
      const balanceResponse = await fetch(`/api/cfip/check-balance?address=${activeAddress}`);
      if (!balanceResponse.ok) {
        throw new Error('Failed to check FRY balance');
      }
      const balanceResult = await balanceResponse.json();
      if (!balanceResult.eligible) {
        setError(`Insufficient FRY balance. You need at least ${balanceResult.required.toFixed(2)} FRY.`);
        setVoting(false);
        return;
      }

      // Build transaction
      const algod = await getAlgodClient();
      const txns = await buildCastTempVote(algod, activeAddress, voteId, optionIndex);

      // Sign transactions
      const encodedTxns = txns.map(txn => algosdk.encodeUnsignedTransaction(txn));
      const signedTxns = await signTransactions(encodedTxns);

      // Submit
      const txnsToSend = signedTxns.filter((t): t is Uint8Array => t !== null);
      const { txid } = await algod.sendRawTransaction(txnsToSend).do();
      await algosdk.waitForConfirmation(algod, txid, 4);
      const id = txid;
      console.log('Vote cast, txId:', id);

      setSuccess(`Vote recorded! Transaction: ${id.substring(0, 8)}...`);
      
      // Refresh status
      setTimeout(() => {
        fetchStatus();
        onVoteSuccess?.();
      }, 2000);

    } catch (err: any) {
      console.error('Failed to vote:', err);
      if (err.message?.includes('rejected') || err.message?.includes('cancelled')) {
        setError('Transaction was cancelled');
      } else if (err.message?.includes('Already voted')) {
        setError('You have already voted on this temp check');
      } else {
        setError(err.message || 'Failed to cast vote');
      }
    }

    setVoting(false);
  };

  if (loading) {
    return (
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
        <Text className="text-[var(--text-secondary)]">Loading temp check status...</Text>
      </Card>
    );
  }

  if (!data) {
    return null; // No temp check exists
  }

  const totalVotes = data.yesVotes + data.noVotes;
  const yesPercent = totalVotes > 0 ? Math.round((data.yesVotes / totalVotes) * 100) : 0;
  const noPercent = totalVotes > 0 ? Math.round((data.noVotes / totalVotes) * 100) : 0;
  const isExpired = Date.now() / 1000 > data.endDate;
  const isActive = !data.closed && !isExpired;
  const mbrAlgo = Number(STAKE_BOX_MBR) / 1_000_000;

  return (
    <Card className="bg-[var(--bg-card)] border border-amber-500/50 mb-6">
      <Flex justifyContent="between" alignItems="center" className="mb-4">
        <Title className="text-[var(--text-heading)] text-lg flex items-center gap-2">
          <RiTimeLine className="text-amber-500" />
          Temperature Check
        </Title>
        <Text className="text-[var(--text-secondary)] text-sm">
          {isActive ? (
            <>Ends {new Date(data.endDate * 1000).toLocaleDateString()}</>
          ) : data.closed ? (
            <span className="text-gray-500">Closed</span>
          ) : (
            <span className="text-rose-500">Expired</span>
          )}
        </Text>
      </Flex>

      {error && (
        <Callout title="Error" color="rose" className="mb-4">
          {error}
        </Callout>
      )}

      {success && (
        <Callout title="Success" color="emerald" className="mb-4">
          {success}
        </Callout>
      )}

      <div className="space-y-4">
        {/* Yes option */}
        <div>
          <Flex justifyContent="between" className="mb-1">
            <Text className="text-[var(--text-primary)]">Yes</Text>
            <Text className="text-[var(--text-secondary)]">
              {data.yesVotes} vote{data.yesVotes !== 1 ? 's' : ''} ({yesPercent}%)
            </Text>
          </Flex>
          <ProgressBar value={yesPercent} color="emerald" />
        </div>

        {/* No option */}
        <div>
          <Flex justifyContent="between" className="mb-1">
            <Text className="text-[var(--text-primary)]">No</Text>
            <Text className="text-[var(--text-secondary)]">
              {data.noVotes} vote{data.noVotes !== 1 ? 's' : ''} ({noPercent}%)
            </Text>
          </Flex>
          <ProgressBar value={noPercent} color="rose" />
        </div>
      </div>

      {isActive && activeAddress && !data.userHasVoted && (
        <>
          <Text className="text-[var(--text-secondary)] text-xs mt-4 mb-2">
            Cost: {mbrAlgo.toFixed(2)} ALGO (box storage)
          </Text>
          <Flex className="gap-3 mt-2">
            <Button
              color="emerald"
              icon={RiCheckLine}
              className="flex-1"
              onClick={() => handleVote(0)}
              disabled={voting}
            >
              {voting ? 'Voting...' : 'Vote Yes'}
            </Button>
            <Button
              color="rose"
              icon={RiCloseLine}
              className="flex-1"
              onClick={() => handleVote(1)}
              disabled={voting}
            >
              {voting ? 'Voting...' : 'Vote No'}
            </Button>
          </Flex>
        </>
      )}

      {isActive && activeAddress && data.userHasVoted && (
        <Callout title="Voted" color="blue" className="mt-4">
          You have already voted on this temp check.
        </Callout>
      )}

      {isActive && !activeAddress && (
        <Text className="text-[var(--text-secondary)] text-center mt-4">
          Connect your wallet to vote
        </Text>
      )}

      {!isActive && (
        <Text className="text-[var(--text-secondary)] text-center mt-4">
          Total: {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
        </Text>
      )}
    </Card>
  );
}
