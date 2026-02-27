import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import algosdk from 'algosdk';
import { SupportedWallet, WalletAccount, WalletId, WalletManager } from '@txnlab/use-wallet';

export const PROVIDER_ID = {
  DEFLY: WalletId.DEFLY,
  PERA: WalletId.PERA,
  EXODUS: WalletId.EXODUS,
  KIBISIS: WalletId.KIBISIS
} as const;

type ProviderId = (typeof PROVIDER_ID)[keyof typeof PROVIDER_ID];

type ProviderInit = {
  id: ProviderId;
  clientStatic?: unknown;
};

type InitializeConfig = {
  providers: ProviderInit[];
};

type LegacyAccount = WalletAccount & {
  providerId: string;
};

type LegacyProvider = {
  metadata: {
    id: string;
    name: string;
    icon: string;
  };
  isConnected: boolean;
  isActive: boolean;
  accounts: WalletAccount[];
  connect: () => Promise<WalletAccount[]>;
  disconnect: () => Promise<void>;
  setActiveAccount: (address: string) => void;
};

type WalletContextValue = {
  providers: LegacyProvider[];
  activeAccount: LegacyAccount | null;
  activeAddress: string | null;
  signTransactions: (txns: Uint8Array[]) => Promise<(Uint8Array | null)[]>;
  sendTransactions: (
    signedTxns: (Uint8Array | null)[],
    waitRoundsToConfirm?: number
  ) => Promise<{ id: string }>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function useInitializeProviders(config: InitializeConfig): InitializeConfig {
  return config;
}

export function WalletProvider({
  value,
  children
}: {
  value: InitializeConfig;
  children: ReactNode;
}) {
  const managerRef = useRef<WalletManager | null>(null);
  const [tick, setTick] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!managerRef.current) {
      const manager = new WalletManager({
        wallets: value.providers.map((provider) => provider.id) as SupportedWallet[],
        defaultNetwork: 'mainnet',
        networks: {
          mainnet: {
            algod: {
              token: '',
              baseServer: 'https://mainnet-api.algonode.cloud'
            }
          }
        },
        options: { resetNetwork: true }
      });
      managerRef.current = manager;
      setIsReady(true);
      void manager.resumeSessions().catch(() => {});
    }

    const manager = managerRef.current as WalletManager;
    return manager.subscribe(() => {
      setTick((current) => current + 1);
    });
  }, []);

  const contextValue = useMemo<WalletContextValue>(() => {
    const manager = managerRef.current;
    if (!manager || !isReady) {
      return {
        providers: [],
        activeAccount: null,
        activeAddress: null,
        signTransactions: async () => {
          throw new Error('Wallet manager not ready');
        },
        sendTransactions: async () => {
          throw new Error('Wallet manager not ready');
        }
      };
    }

    const providers: LegacyProvider[] = manager.wallets.map((wallet) => ({
      metadata: {
        id: wallet.id,
        name: wallet.name,
        icon: wallet.metadata.icon
      },
      isConnected: wallet.isConnected,
      isActive: wallet.isActive,
      accounts: wallet.accounts,
      connect: () => wallet.connect(),
      disconnect: () => wallet.disconnect(),
      setActiveAccount: (address: string) => wallet.setActiveAccount(address)
    }));

    const activeWallet = manager.activeWallet;
    const activeAccount = manager.activeAccount
      ? {
          ...manager.activeAccount,
          providerId: activeWallet?.id ?? ''
        }
      : null;

    return {
      providers,
      activeAccount,
      activeAddress: manager.activeAddress,
      signTransactions: async (txns: Uint8Array[]) => {
        if (!manager.activeWallet) {
          throw new Error('Wallet is not connected');
        }
        return manager.activeWallet.signTransactions(txns);
      },
      sendTransactions: async (
        signedTxns: (Uint8Array | null)[],
        waitRoundsToConfirm = 4
      ) => {
        const txnsToSend = signedTxns.filter(
          (txn): txn is Uint8Array => txn !== null
        );
        if (!txnsToSend.length) {
          throw new Error('No signed transactions to send');
        }

        const { txid } = await manager.algodClient.sendRawTransaction(txnsToSend).do();
        if (waitRoundsToConfirm > 0) {
          await algosdk.waitForConfirmation(
            manager.algodClient,
            txid,
            waitRoundsToConfirm
          );
        }
        return { id: txid };
      }
    };
  }, [isReady, tick]);

  return (
    <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
