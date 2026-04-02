import { useState } from 'react';
import { Button, Callout, Dialog, DialogPanel, Divider, Text, Title } from '@tremor/react';
import { RiTimeLine, RiCloseLine } from '@remixicon/react';
import algosdk from 'algosdk';
import { useWallet } from '../lib/use-wallet-compat';
import { checkFryBalance } from '../lib/fry-balance';
import {
  buildRequestTempCheck,
  getAlgodClient,
  makeVoteId,
  MAX_TEMP_CHECK_DURATION,
  VOTE_BOX_MBR
} from '../lib/governance-client';

interface TempCheckButtonProps {
  cfipId: string;
  cfipTitle: string;
  onSuccess: () => void;
}

export default function TempCheckButton({ cfipId, cfipTitle, onSuccess }: TempCheckButtonProps) {
  const { activeAddress, signTransactions, sendTransactions } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRequestTempCheck = async () => {
    if (!activeAddress) {
      setError('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Check FRY balance eligibility
      const balanceResult = await checkFryBalance(activeAddress);
      if (!balanceResult.eligible) {
        setError(`Insufficient FRY balance. You need at least ${balanceResult.required.toFixed(2)} FRY (~$${balanceResult.thresholdUsd} USD). You have ${balanceResult.balance.toFixed(2)} FRY.`);
        setIsProcessing(false);
        return;
      }

      // Generate vote ID from cFIP ID
      const voteId = makeVoteId(`cfip-${cfipId}`);
      
      // End date = now + 7 days
      const endDate = Math.floor(Date.now() / 1000) + MAX_TEMP_CHECK_DURATION;

      // Build transaction
      const algod = await getAlgodClient();
      const txns = await buildRequestTempCheck(algod, activeAddress, voteId, endDate);

      // Sign transactions
      const encodedTxns = txns.map(txn => algosdk.encodeUnsignedTransaction(txn));
      const signedTxns = await signTransactions(encodedTxns);

      // Submit
      const { id } = await sendTransactions(signedTxns, 4);
      console.log('Temp check created, txId:', id);

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        onSuccess();
      }, 2000);

    } catch (err: any) {
      console.error('Failed to create temp check:', err);
      if (err.message?.includes('rejected') || err.message?.includes('cancelled')) {
        setError('Transaction was cancelled');
      } else if (err.message?.includes('Vote already exists')) {
        setError('A temp check already exists for this proposal');
      } else {
        setError(err.message || 'Failed to create temp check');
      }
    }

    setIsProcessing(false);
  };

  const mbrAlgo = Number(VOTE_BOX_MBR) / 1_000_000;

  return (
    <>
      <Button
        color="amber"
        icon={RiTimeLine}
        onClick={() => setIsOpen(true)}
        
      >
        Request Temp Check
      </Button>

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

          <Title className="text-[var(--text-heading)]">Request Temperature Check</Title>
          <Text className="text-[var(--text-secondary)] mt-2">
            Create a 7-day temperature check vote for "{cfipTitle}"
          </Text>

          <Divider />

          {error && (
            <Callout title="Error" color="rose" className="mb-4">
              {error}
            </Callout>
          )}

          {success && (
            <Callout title="Success" color="emerald" className="mb-4">
              Temp check created! The page will refresh shortly.
            </Callout>
          )}

          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
            <div className="flex justify-between">
              <span>Duration:</span>
              <span className="text-[var(--text-primary)]">7 days</span>
            </div>
            <div className="flex justify-between">
              <span>Options:</span>
              <span className="text-[var(--text-primary)]">Yes / No</span>
            </div>
            <div className="flex justify-between">
              <span>Cost:</span>
              <span className="text-[var(--text-primary)]">{mbrAlgo.toFixed(2)} ALGO (box storage)</span>
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
              color="amber"
              className="flex-1"
              onClick={handleRequestTempCheck}
              disabled={isProcessing || success}
            >
              {isProcessing ? 'Creating...' : 'Create Temp Check'}
            </Button>
          </div>
        </DialogPanel>
      </Dialog>
    </>
  );
}
