import {
    Button,
    Flex,
    Textarea,
    DatePicker,
    NumberInput,


} from '@tremor/react';
import { Key, useState } from 'react';
import algosdk from 'algosdk'
import { Dialog, DialogPanel, Divider, TextInput } from '@tremor/react';
import { RiCloseLine } from '@remixicon/react';
import { useWallet } from '@txnlab/use-wallet';
const algodClient = new algosdk.Algodv2(
    "",
    "https://mainnet-api.algonode.cloud",
    ""
  );
const BURN_ADDRESS = 'MO3FUXGKGZRTVYOSCXR3FXMPZQCZHR2BGGT2B5SINVBA3W6YCZNO25GGLM';
const FRYIndex = 924268058;
export default function ModalVote({ isOpen, setIsOpen, vote }: { isOpen: boolean, setIsOpen: Function, vote: { index: number, title: string, description:string } }) {
    const { activeAddress, signTransactions, sendTransactions } = useWallet()
    const sendTransaction = async (from?: string, to?: string, amount?: number) => {
        try {
          if (!from || !to || !amount) {
            throw new Error('Missing transaction params.')
          }
    
          const suggestedParams = await algodClient.getTransactionParams().do()
    
          const transaction = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            from,
            to,
            amount,
            assetIndex: FRYIndex,
            suggestedParams
          })
    
          const encodedTransaction = algosdk.encodeUnsignedTransaction(transaction)
          const signedTransactions = await signTransactions([encodedTransaction])
          const waitRoundsToConfirm = 4
          const { id } = await sendTransactions(signedTransactions, waitRoundsToConfirm)
    
          console.log('Successfully sent transaction. Transaction ID: ', id)
        } catch (error) {
          console.error(error)
        }
      }
    const [voteValue, setVoteValue] = useState(1);

    const handleVote = (index: number, value: number) => {
        
        console.log(`Voted ${value} votes for ${vote.title}`);
        sendTransaction(activeAddress, BURN_ADDRESS, value*1e6);

    }

    return (<Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        static={true}
        className="z-[100]"
    >
        <DialogPanel className="sm:max-w-5xl">
            <div className="absolute right-0 top-0 pr-3 pt-3">
                <button
                    type="button"
                    className="rounded-tremor-small p-2 text-tremor-content-subtle hover:bg-tremor-background-subtle hover:text-tremor-content dark:text-dark-tremor-content-subtle hover:dark:bg-dark-tremor-background-subtle hover:dark:text-tremor-content"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close"
                >
                    <RiCloseLine
                        className="h-5 w-5 shrink-0"
                        aria-hidden={true}
                    />
                </button>
            </div>
            <form action="#" method="POST">
                <h4 className="font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                    Vote for {vote.title}
                </h4>
                <p className="text-tremor-content-subtle dark:text-dark-tremor-content-subtle">
                    {vote.description}
                </p>
                <Divider />

                <NumberInput placeholder="Number of votes (1 vote = 1 $FRY)" min={1} defaultValue={1} onValueChange={(value) => {
           setVoteValue(value);
           console.log(voteValue)
                }} />

                <Button
                    className="mt-4"
                    color="blue"
                    disabled={!(voteValue >= 1)}
                    onClick={(e) => {
                        e.preventDefault();
                        console.log(`Voted ${voteValue} votes for ${vote.title}`);
                        handleVote(vote.index, voteValue);
                    }}
                >
                    Vote (will initiate a transaction)
                </Button>
            </form>
        </DialogPanel>
    </Dialog>
    );
}