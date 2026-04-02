import { useState } from 'react';
import { Button, Callout, Dialog, DialogPanel, Divider, NumberInput, Text, Title } from '@tremor/react';
import { RiCloseLine } from '@remixicon/react';
import algosdk from 'algosdk';
import { useWallet } from '../lib/use-wallet-compat';
import {
  buildCastVote,
  STAKE_BOX_MBR,
  waitForConfirmationJson
} from '../lib/governance-client';
import { sanitizeHtml } from '../lib/sanitize-html';

interface CastVoteModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  vote: {
    contractVoteId: string;  // hex string of vote_id bytes
    title: string;
    description: string;
    optionTitle: string;
    optionIndex: number;
  };
  onSuccess?: () => void;
}

export default function CastVoteModal({ isOpen, setIsOpen, vote, onSuccess }: CastVoteModalProps) {
  const { activeAddress, signTransactions, sendTransactions } = useWallet();
  const [fryAmount, setFryAmount] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCastVote = async () => {
    if (!activeAddress) {
      setError('Please connect your wallet first');
      return;
    }

    if (!Number.isInteger(fryAmount) || fryAmount < 1) {
      setError('Please enter a valid FRY amount (minimum 1)');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStatus('Preparing transaction...');

    try {
      // Convert hex contractVoteId to Uint8Array
      const voteId = new Uint8Array(
        (vote.contractVoteId.match(/.{1,2}/g) || []).map(b => parseInt(b, 16))
      );

      // Convert FRY to base units (6 decimals)
      const fryAmountBaseUnits = BigInt(Math.round(fryAmount * 1_000_000));

      // Build 3-txn group
      const txns = await buildCastVote(activeAddress, voteId, vote.optionIndex, fryAmountBaseUnits);

      setStatus('Please sign in your wallet...');

      // Encode and sign
      const encodedTxns = txns.map(txn => algosdk.encodeUnsignedTransaction(txn));
      const signedTxns = await signTransactions(encodedTxns);

      setStatus('Submitting transaction...');

      // Submit
      const txnsToSend = signedTxns.filter((t): t is Uint8Array => t !== null);
      const { id: txid } = await sendTransactions(txnsToSend, 4);

      setStatus('Waiting for confirmation...');

      // Wait for confirmation using JSON endpoint
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3012';
      await waitForConfirmationJson(txid, baseUrl, 8);

      console.log('Vote cast successfully, txId:', txid);
      setSuccess(true);
      setStatus(null);

      setTimeout(() => {
        setIsOpen(false);
        onSuccess?.();
      }, 2000);

    } catch (err: any) {
      console.error('Failed to cast vote:', err);
      setStatus(null);
      if (err.message?.includes('rejected') || err.message?.includes('cancelled')) {
        setError('Transaction was cancelled');
      } else if (err.message?.includes('Already voted')) {
        setError('You have already voted on this proposal');
      } else if (err.message?.includes('overspend')) {
        setError('Insufficient FRY balance');
      } else {
        setError(err.message || 'Failed to cast vote');
      }
    }

    setIsProcessing(false);
  };

  const mbrAlgo = Number(STAKE_BOX_MBR) / 1_000_000;

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
          Vote for {vote.title}
        </Title>
        <Text className="text-[var(--text-secondary)] mt-1">
          Option: <span className="text-[var(--text-primary)] font-medium">{vote.optionTitle}</span>
        </Text>

        <div
          className="text-[var(--text-secondary)] mt-2 text-sm max-h-24 overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(vote.description) }}
        />

        <Divider />

        {error && (
          <Callout title="Error" color="rose" className="mb-4">
            {error}
          </Callout>
        )}

        {success && (
          <Callout title="Success" color="emerald" className="mb-4">
            Your vote has been recorded on-chain!
          </Callout>
        )}

        {status && (
          <Callout title="Processing" color="blue" className="mb-4">
            {status}
          </Callout>
        )}

        <div className="space-y-4">
          <div>
            <Text className="text-[var(--text-secondary)] mb-2">
              FRY to stake (locked until vote ends + lock period)
            </Text>
            <NumberInput
              placeholder="Enter FRY amount"
              min={1}
              value={fryAmount}
              onValueChange={(val) => setFryAmount(val)}
              className="bg-[var(--bg-secondary)] border-[var(--border-color)]"
              disabled={isProcessing || success}
            />
          </div>

          <div className="text-sm text-[var(--text-secondary)] space-y-1">
            <div className="flex justify-between">
              <span>FRY to stake:</span>
              <span className="text-[var(--text-primary)]">{fryAmount} FRY</span>
            </div>
            <div className="flex justify-between">
              <span>Box storage cost:</span>
              <span className="text-[var(--text-primary)]">{mbrAlgo.toFixed(4)} ALGO</span>
            </div>
          </div>
        </div>

        <Divider />

        <div className="flex gap-3">
          <Button
            color="gray"
            className="flex-1"
            onClick={() => setIsOpen(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            color="emerald"
            className="flex-1"
            onClick={handleCastVote}
            disabled={isProcessing || success || !Number.isInteger(fryAmount) || fryAmount < 1}
          >
            {isProcessing ? 'Processing...' : 'Cast Vote'}
          </Button>
        </div>
      </DialogPanel>
    </Dialog>
  );
}
