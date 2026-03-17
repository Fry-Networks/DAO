import { NextPage } from 'next';
import { AppProps } from 'next/app';
import '../app/globals.css';
import { WalletProvider, useInitializeProviders, PROVIDER_ID } from '../lib/use-wallet-compat';
import Navbar from '../app/navbar';

interface MyAppProps extends AppProps {
  Component: NextPage;
}

export default function MyApp({ Component, pageProps }: MyAppProps) {
  const providers = useInitializeProviders({
    providers: [
      { id: PROVIDER_ID.DEFLY },
      { id: PROVIDER_ID.PERA }
    ]
  });

  return (
    <WalletProvider value={providers}>
      <Navbar />
      <div id="main" className="w-full min-h-screen bg-[#0f0f0f] text-[#e0e0e0]">
        <Component {...pageProps} />
      </div>
    </WalletProvider>
  );
}
