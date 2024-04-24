import { NextPage } from 'next';
import { AppProps } from 'next/app';
import '../app/globals.css';
import { useSession, SessionProvider } from 'next-auth/react';

import Navbar from '../app/navbar';
import { useRouter } from 'next/router';
interface MyAppProps extends AppProps {
  Component: NextPage;
}

interface ProtectedComponentProps {
  Component: NextPage;
  pageProps: any; // If you have a specific type for your pageProps, you can replace `any` with that.
}

export default function MyApp({ Component, pageProps }: MyAppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <Navbar />
      <div id="main">
        <ProtectedComponent Component={Component} pageProps={pageProps} />
      </div>
    </SessionProvider>
  );
}

const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  Component,
  pageProps
}) => {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const router = useRouter();
  const showInfo = (text: string) => {
    return (
      <p
        style={{
          margin: '50px'
        }}
      >
        {text}
      </p>
    );
  };

  if (isLoading) return showInfo('Loading...');


  return <Component {...pageProps} />;
};
