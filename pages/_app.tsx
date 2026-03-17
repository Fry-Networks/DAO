import { NextPage } from 'next';
import { AppProps } from 'next/app';
import '../app/globals.css';
import { WalletProvider, useInitializeProviders, PROVIDER_ID } from '../lib/use-wallet-compat';
import Navbar from '../app/navbar';
import Footer from '../components/footer';

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
      <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <Navbar />
        <main id="main" className="flex-1 w-full">
          <Component {...pageProps} />
        </main>
        <Footer />
      </div>
    </WalletProvider>
  );
}
