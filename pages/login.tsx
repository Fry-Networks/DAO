import { getProviders, signIn } from 'next-auth/react'

export default function SignIn({ providers }: { providers: any }) {
  return (
    <div>
      <h1>Login Page</h1>
      {Object.values(providers).map((provider: any) => {
        if (provider.name === 'Email') {
          return;
        }
        return (
          <div key={provider.name}>
            <button onClick={() => signIn(provider.id)}>Sign in with {provider.name}</button>
          </div>
        );
      })}
    </div>
  );
}

// This is the recommended way for Next.js 9.3 or newer
export async function getServerSideProps(){
  const providers = await getProviders();
  return {
    props: { providers }
  };
}
