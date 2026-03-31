import { useState, useEffect } from 'react';
import { Button, Card, Flex, Title, Text, TextInput, Textarea, Callout } from '@tremor/react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useWallet } from '../../lib/use-wallet-compat';
import { RiCheckLine, RiCloseLine, RiAddLine, RiDeleteBinLine } from '@remixicon/react';

interface BalanceCheck {
  eligible: boolean;
  balance: number;
  required: number;
  priceUsd: number;
  thresholdUsd: number;
}

export default function NewCfipPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { activeAccount, providers } = useWallet();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState([
    { title: '', description: '' },
    { title: '', description: '' }
  ]);
  const [balanceCheck, setBalanceCheck] = useState<BalanceCheck | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Check balance when wallet connects
  useEffect(() => {
    if (activeAccount?.address) {
      checkFryBalance(activeAccount.address);
    } else {
      setBalanceCheck(null);
    }
  }, [activeAccount?.address]);

  const checkFryBalance = async (address: string) => {
    setCheckingBalance(true);
    setError('');
    try {
      const res = await fetch(`/api/cfip/check-balance?address=${address}`);
      const data = await res.json();
      if (res.ok) {
        setBalanceCheck(data);
      } else {
        setError(data.error || 'Failed to check balance');
      }
    } catch (err) {
      setError('Failed to check FRY balance');
    }
    setCheckingBalance(false);
  };

  const addOption = () => {
    if (options.length < 8) {
      setOptions([...options, { title: '', description: '' }]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, field: 'title' | 'description', value: string) => {
    const newOptions = [...options];
    newOptions[index][field] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount?.address || !balanceCheck?.eligible) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/cfip/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          options,
          walletAddress: activeAccount.address
        })
      });

      const data = await res.json();
      if (res.ok) {
        router.push(`/cfip/${data.id}`);
      } else {
        setError(data.error || 'Failed to create cFIP');
      }
    } catch (err) {
      setError('Failed to submit cFIP');
    }

    setSubmitting(false);
  };

  // Auth loading
  if (status === 'loading') {
    return (
      <main className="p-4 md:p-10 mx-auto max-w-3xl">
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
          <Text className="text-[var(--text-secondary)] text-center py-8">Loading...</Text>
        </Card>
      </main>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <main className="p-4 md:p-10 mx-auto max-w-3xl">
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
          <Title className="text-[var(--text-heading)] mb-4">Sign In Required</Title>
          <Text className="text-[var(--text-secondary)] mb-4">
            You must sign in with Discord to submit a community proposal.
          </Text>
          <Button onClick={() => signIn('discord')} color="rose">
            Sign in with Discord
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-10 mx-auto max-w-3xl">
      <Title className="text-[var(--text-heading)] mb-6">Submit Community Proposal (cFIP)</Title>

      {error && (
        <Callout title="Error" color="rose" className="mb-4" icon={RiCloseLine}>
          {error}
        </Callout>
      )}

      {/* Wallet Connection */}
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] mb-6">
        <Title className="text-[var(--text-heading)] text-lg mb-3">Step 1: Connect Wallet</Title>
        <Text className="text-[var(--text-secondary)] mb-4">
          Connect your Algorand wallet to verify your FRY holdings. You need at least $50 worth of FRY to submit a proposal.
        </Text>
        
        {!activeAccount ? (
          <Flex className="gap-4 flex-wrap">
            {providers?.map((provider) => (
              <Button
                key={provider.metadata.id}
                onClick={provider.connect}
                disabled={provider.isConnected}
                color={provider.isConnected ? 'emerald' : 'gray'}
              >
                <Flex alignItems="center" className="gap-2">
                  <img src={provider.metadata.icon} alt="" className="w-5 h-5 rounded" />
                  {provider.metadata.name}
                </Flex>
              </Button>
            ))}
          </Flex>
        ) : (
          <div>
            <Flex alignItems="center" className="gap-2 mb-2">
              <Text className="text-[var(--text-primary)] font-mono text-sm">
                {activeAccount.address.slice(0, 8)}...{activeAccount.address.slice(-8)}
              </Text>
              <Button size="xs" color="gray" onClick={() => providers?.find(p => p.isActive)?.disconnect()}>
                Disconnect
              </Button>
            </Flex>
            
            {checkingBalance ? (
              <Text className="text-[var(--text-secondary)]">Checking balance...</Text>
            ) : balanceCheck ? (
              <Callout
                title={balanceCheck.eligible ? "Eligible" : "Insufficient Balance"} 
                color={balanceCheck.eligible ? 'emerald' : 'rose'} 
                icon={balanceCheck.eligible ? RiCheckLine : RiCloseLine}
              >
                {balanceCheck.eligible ? (
                  <>You have {balanceCheck.balance.toLocaleString()} FRY (${(balanceCheck.balance * balanceCheck.priceUsd).toFixed(2)}). Eligible to submit!</>
                ) : (
                  <>You have {balanceCheck.balance.toLocaleString()} FRY but need {balanceCheck.required.toLocaleString()} FRY (~${balanceCheck.thresholdUsd}).</>
                )}
              </Callout>
            ) : null}
          </div>
        )}
      </Card>

      {/* Proposal Form */}
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
        <form onSubmit={handleSubmit}>
          <Title className="text-[var(--text-heading)] text-lg mb-3">Step 2: Proposal Details</Title>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Title (min 10 characters)
              </label>
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a clear, descriptive title"
                className="bg-[var(--bg-secondary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Description (min 50 characters, Markdown supported)
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your proposal in detail. Explain the problem, your solution, and expected impact."
                rows={6}
                className="bg-[var(--bg-secondary)]"
              />
            </div>

            <div>
              <Flex justifyContent="between" alignItems="center" className="mb-2">
                <label className="block text-sm font-medium text-[var(--text-primary)]">
                  Voting Options (2-8)
                </label>
                <Button 
                  type="button" 
                  size="xs" 
                  color="gray" 
                  onClick={addOption}
                  disabled={options.length >= 8}
                  icon={RiAddLine}
                >
                  Add Option
                </Button>
              </Flex>
              
              <div className="space-y-3">
                {options.map((option, index) => (
                  <Card key={index} className="bg-[var(--bg-secondary)] p-3">
                    <Flex justifyContent="between" alignItems="center" className="mb-2">
                      <Text className="text-[var(--text-secondary)] text-sm">Option {index + 1}</Text>
                      {options.length > 2 && (
                        <Button 
                          type="button" 
                          size="xs" 
                          color="rose" 
                          variant="light"
                          onClick={() => removeOption(index)}
                          icon={RiDeleteBinLine}
                        />
                      )}
                    </Flex>
                    <TextInput
                      value={option.title}
                      onChange={(e) => updateOption(index, 'title', e.target.value)}
                      placeholder="Option title"
                      className="mb-2 bg-[var(--bg-card)]"
                    />
                    <TextInput
                      value={option.description}
                      onChange={(e) => updateOption(index, 'description', e.target.value)}
                      placeholder="Option description (optional)"
                      className="bg-[var(--bg-card)]"
                    />
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <Button
            type="submit"
            color="rose"
            className="w-full mt-6"
            disabled={
              !balanceCheck?.eligible ||
              title.length < 10 ||
              description.length < 50 ||
              !options.every(o => o.title.trim()) ||
              submitting
            }
          >
            {submitting ? 'Submitting...' : 'Submit Proposal'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
