import {
    Button,
    Flex,
    Textarea,
    DatePicker,
    NumberInput,


} from '@tremor/react';
import { Key, useState } from 'react';
import '../app/css/devices.css';
import { Vote } from '../lib/vote-schema';
import { Dialog, DialogPanel, Divider, TextInput } from '@tremor/react';

import { RiCloseLine } from '@remixicon/react';
export default function ModalVote({ isOpen, setIsOpen, vote }: { isOpen: boolean, setIsOpen: Function, vote: { index: number, title: string, description:string } }) {

    const [voteValue, setVoteValue] = useState(0);
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

                <NumberInput placeholder="Number of votes (1 vote = 1 $FRY)" min={1}  onValueChange={(value) => setVoteValue(value)} />
            </form>
        </DialogPanel>
    </Dialog>
    );
}