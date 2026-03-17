import React from 'react'
import { useWallet } from '../lib/use-wallet-compat'
import { Button, Flex, Select } from '@tremor/react'

export default function ConnectMenu() {
    const { providers, activeAccount } = useWallet()
    return (
        <Flex flexDirection='col' justifyContent='between' alignItems='center' className="gap-4">
            <Flex flexDirection='row' justifyContent='center' alignItems='center' className="gap-8 flex-wrap">
                {providers?.filter(provider => {
                    return activeAccount ? provider.metadata.id == activeAccount.providerId : true
                }).map((provider) => (
                    <Flex 
                        key={provider.metadata.id} 
                        flexDirection='col' 
                        justifyContent='center' 
                        alignItems='center'
                        className="bg-[var(--bg-card)] p-6 rounded-xl border border-[var(--border-color)] gap-3"
                    >
                        <img
                            width={48}
                            height={48}
                            alt={`${provider.metadata.name} icon`}
                            src={provider.metadata.icon}
                            className="rounded-lg"
                        />
                        <span className="text-[var(--text-primary)] font-medium">{provider.metadata.name}</span>
                        <Button 
                            className='mb-2' 
                            onClick={provider.connect} 
                            disabled={provider.isConnected || !!activeAccount} 
                            color={provider.isConnected ? 'emerald' : 'rose'}
                        >
                            {provider.isConnected ? 'Connected' : 'Connect'}
                        </Button>

                        {provider.isActive && provider.accounts.length && (
                            <>
                                <Button 
                                    onClick={provider.disconnect} 
                                    disabled={!provider.isConnected} 
                                    color='gray' 
                                    className='mb-2'
                                >
                                    Disconnect
                                </Button>
                                <Select
                                    value={activeAccount?.address}
                                    onValueChange={(value) => provider.setActiveAccount(value)}
                                    className="bg-[var(--bg-secondary)] border-[var(--border-color)]"
                                >
                                    {provider.accounts.map((account) => (
                                        <option key={account.address} value={account.address}>
                                            {account.address}
                                        </option>
                                    ))}
                                </Select>
                            </>
                        )}
                    </Flex>
                ))}
            </Flex>
            {activeAccount && (
                <p className="text-emerald-400 mt-4 text-center">
                    You are successfully connected and can now head to the Vote page to cast your vote!
                </p>
            )}
        </Flex>
    )
}
