import { useState, useEffect } from 'react';
import { Button, Callout, Dialog, DialogPanel, Divider, Text, Title } from '@tremor/react';
import { RiCloseLine, RiTimeLine } from '@remixicon/react';
import algosdk from 'algosdk';
import { useWallet } from '../lib/use-wallet-compat';
import { buildWithdraw, waitForConfirmationJson } from '../lib/governance-client';

interface WithdrawModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  voteTitle: string;
  contractVoteId: string;
  stakeInfo: {
    optionIndex: number;
    tokenAmount: bigint;
    withdrawn: boolean;
  };
  lockEndsAt: number;  // unix timestamp (endDate + lockDuration)
  onSuccess?: () => void;
}

export default function WithdrawModal({
  isOpen,
  setIsOpen,
  voteTitle,
  contractVoteId,
  stakeInfo,
  lockEndsAt,
  onSuccess
}: WithdrawModalProps) {
  const { activeAddress, signTransactions, sendTransactions } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isLockExpired = nowSeconds >= lockEndsAt;
  const canWithdraw = isLockExpired && !stakeInfo.withdrawn;

  // Format token amount (6 decimals)
  const fryAmount = Number(stakeInfo.tokenAmount) / 1_000_000;

  useEffect(() => {
    if (stakeInfo.withdrawn || isLockExpired) return;

    const updateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = lockEndsAt - now;
      if (diff <= 0) {
        setTimeLeft('');
        return;
      }
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${mins}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m`);
      } else {
        setTimeLeft(`${mins}m`);
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [lockEndsAt, stakeInfo.withdrawn, isLockExpired]);

  const handleWithdraw = async () => {
    if (!activeAddress || !canWithdraw) return;

    setIsProcessing(true);
    setError(null);
    setStatus('Preparing withdrawal...');

    try {
      // Convert hex contractVoteId to Uint8Array
      const voteId = new Uint8Array(
        (contractVoteId.match(/.{1,2}/g) || []).map(b => parseInt(b, 16))
      );

      // Build withdraw transaction
      const txn = await buildWithdraw(activeAddress, voteId);

      setStatus('Please sign in your wallet...');

      // Encode and sign
      const encodedTxn = algosdk.encodeUnsignedTransaction(txn);
      const signedTxns = await signTransactions([encodedTxn]);

      setStatus('Submitting transaction...');

      // Submit
      const txnsToSend = signedTxns.filter((t): t is Uint8Array => t !== null);
      const { id: txid } = await sendTransactions(txnsToSend, 4);

      setStatus('Waiting for confirmation...');

      // Wait for confirmation
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3012';
      await waitForConfirmationJson(txid, baseUrl, 8);

      console.log('Withdrawal successful, txId:', txid);
      setSuccess(true);
      setStatus(null);

      setTimeout(() => {
        setIsOpen(false);
        onSuccess?.();
      }, 2000);

    } catch (err: any) {
      console.error('Failed to withdraw:', err);
      setStatus(null);
      if (err.message?.includes('rejected') || err.message?.includes('cancelled')) {
        setError('Transaction was cancelled');
      } else if (err.message?.includes('Lock period')) {
        setError('Lock period has not expired yet');
      } else {
        setError(err.message || 'Failed to withdraw');
      }
    }

    setIsProcessing(false);
  };

  return (
    <Dialog open={isOpen} onClose={() => !isProcessing && setIsOpen(false)} static>
      <DialogPanel className="max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
        <div className="absolute right-0 top-0 pr-3 pt-3">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
            onClick={() => !isProcessing && setIsOpen(false)}
            aria-label="Close"
            disabled={isProcessing}
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        <Title className="text-[var(--text-heading)]">
          Withdraw Stake
        </Title>
        <Text className="text-[var(--text-secondary)] mt-1">
          {voteTitle}
        </Text>

        <Divider />

        {error && (
          <Callout title="Error" color="rose" className="mb-4">
            {error}
          </Callout>
        )}

        {success && (
          <Callout title="Success" color="emerald" className="mb-4">
            Your FRY has been withdrawn!
          </Callout>
        )}

        {status && (
          <Callout title="Processing" color="blue" className="mb-4">
            {status}
          </Callout>
        )}

        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Staked amount:</span>
            <span className="text-[var(--text-primary)] font-medium">{fryAmount.toFixed(2)} FRY</span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Lock ends:</span>
            <span className="text-[var(--text-primary)]">
              {new Date(lockEndsAt * 1000).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Status:</span>
            <span className={stakeInfo.withdrawn ? 'text-gray-500' : isLockExpired ? 'text-emerald-500' : 'text-amber-500'}>
              {stakeInfo.withdrawn ? 'Already withdrawn' : isLockExpired ? 'Ready to withdraw' : `Locked (${timeLeft})`}
            </span>
          </div>
        </div>

        <Divider />

        {stakeInfo.withdrawn ? (
          <Callout title="Already Withdrawn" color="gray" className="mb-4">
            You have already withdrawn your stake from this vote.
          </Callout>
        ) : !isLockExpired ? (
          <Callout title="Lock Period Active" color="amber" icon={RiTimeLine} className="mb-4">
            Withdrawal will be available on {new Date(lockEndsAt * 1000).toLocaleString()}
          </Callout>
        ) : null}

        <div className="flex gap-3">
          <Button
            color="gray"
            className="flex-1"
            onClick={() => setIsOpen(false)}
            disabled={isProcessing}
          >
            Close
          </Button>
          <Button
            color="emerald"
            className="flex-1"
            onClick={handleWithdraw}
            disabled={!canWithdraw || isProcessing || success}
          >
            {isProcessing ? 'Processing...' : `Withdraw ${fryAmount.toFixed(2)} FRY`}
          </Button>
        </div>
      </DialogPanel>
    </Dialog>
  );
}
