import {
  Button,
  Flex,
  Textarea,
  DatePicker,
  NumberInput,
  Callout
} from '@tremor/react';
import { Key, useState } from 'react';
import algosdk from 'algosdk';
import { Dialog, DialogPanel, Divider, TextInput } from '@tremor/react';
import { RiCloseLine } from '@remixicon/react';
import { useWallet } from '../lib/use-wallet-compat';
import { set } from 'mongoose';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { Price } from '../lib/price-schema';
import { sanitizeHtml } from '../lib/sanitize-html';

const algodClient = new algosdk.Algodv2(
  '',
  'https://mainnet-api.algonode.cloud',
  ''
);
const BURN_ADDRESS =
  'CM3FF3D3PNCZYD62A7LT6WWG4OBX2JAGVCDRRZRM373SUM6HNR4TFNKYYM';
const FRYIndex = 2485314946;

export default function ModalVote({
  isOpen,
  setIsOpen,
  vote,
  price,
  priceValue
}: {
  isOpen: boolean;
  setIsOpen: Function;
  vote: {
    vote_index: number;
    index: number;
    title: string;
    description: string;
    optionTitle: string;
  };
  price: Price | null;
  priceValue: number;
}) {
  const { activeAddress, signTransactions, sendTransactions } = useWallet();
  const [updateSuccess, setUpdateSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const sendTransaction = async (
    from?: string | null,
    to?: string | null,
    amount?: number
  ) => {
    try {
      if (!from || !to || !amount) {
        throw new Error('Missing transaction params.');
      }

      const suggestedParams = await algodClient.getTransactionParams().do();
      const transaction =
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: from,
          receiver: to,
          amount,
          note: new Uint8Array(
            Buffer.from(vote.index + '-Vote for ' + vote.title)
          ),
          assetIndex: price ? Number(price.asset_id) : FRYIndex,
          suggestedParams
        });

      const encodedTransaction = algosdk.encodeUnsignedTransaction(transaction);
      const signedTransactions = await signTransactions([encodedTransaction]);
      const waitRoundsToConfirm = 4;
      let { id } = await sendTransactions(
        signedTransactions,
        waitRoundsToConfirm
      );
      console.log('Successfully sent transaction. Transaction ID: ', id);
      return id;
    } catch (error) {
      console.error(error);
    }
  };

  const [voteValue, setVoteValue] = useState(1);

  const handleVote = async (index: number, value: number) => {
    setIsProcessing(true);
    console.log(`Voted ${value} votes for ${vote.title}`);
    const txId = await sendTransaction(
      activeAddress,
      BURN_ADDRESS,
      value * priceValue * 1e6
    );
    console.log(txId);
    if (txId) {
      setUpdateSuccess(
        'Successfully sent transaction. Your vote will be verified soon.'
      );
      setTimeout(() => setUpdateSuccess(''), 15_000);
      const assetId = price ? price.asset_id : FRYIndex;
      const response = await fetch('/api/new-vote', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vote_index: vote.vote_index,
          index,
          txId,
          priceValue,
          assetId
        })
      });

      if (!response.ok) {
        setUpdateSuccess('error');
        setTimeout(() => setUpdateSuccess(''), 30_000);
        setIsProcessing(false);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
    } else {
      setUpdateSuccess('error');
      setTimeout(() => setUpdateSuccess(''), 30_000);
    }
    setIsProcessing(false);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={() => setIsOpen(false)}
      static={true}
      className="z-[100]"
    >
      <DialogPanel className="max-w-xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
        <div className="absolute right-0 top-0 pr-3 pt-3">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
          >
            <RiCloseLine className="h-5 w-5 shrink-0" aria-hidden={true} />
          </button>
        </div>
        {updateSuccess != '' && updateSuccess != 'error' && (
          <Callout
            className="mt-4 mb-4 bg-[var(--bg-secondary)] border-emerald-500"
            title="Success"
            icon={CheckCircleIcon}
            color="emerald"
          >
            {updateSuccess}
          </Callout>
        )}
        {updateSuccess == 'error' && (
          <Callout
            className="mt-4 mb-4 bg-[var(--bg-secondary)] border-rose-500"
            title="Error"
            icon={CheckCircleIcon}
            color="rose"
          >
            Error sending transaction. Please contact us before trying again!
          </Callout>
        )}
        <form action="#" method="POST">
          <h4 className="font-semibold text-[var(--text-heading)]">
            Vote for {vote.title} — Option: {vote.optionTitle}
          </h4>
          <div
            className="text-[var(--text-secondary)] mt-2"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(vote.description)
            }}
          />
          <Divider />

          <NumberInput
            placeholder={`Number of votes (1 vote = ${priceValue} $FRY)`}
            min={1}
            defaultValue={1}
            onValueChange={(value) => {
              setVoteValue(value);
            }}
            className="bg-[var(--bg-secondary)] border-[var(--border-color)]"
          />

          <Button
            className="mt-4"
            color="rose"
            disabled={
              isProcessing || !(Number.isInteger(voteValue) && voteValue >= 1)
            }
            onClick={async (e) => {
              e.preventDefault();
              await handleVote(vote.index, voteValue);
            }}
          >
            Vote (will initiate a transaction)
          </Button>
        </form>
      </DialogPanel>
    </Dialog>
  );
}
