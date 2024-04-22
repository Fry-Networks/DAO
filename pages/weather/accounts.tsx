
import { Card, Metric, Text, Title, BarList, Flex, Grid, MultiSelect, MultiSelectItem } from '@tremor/react';
import Search from '../../app/search';
import clientPromise from '../../lib/mongoclient';
import { weatherAccount } from '../../lib/weather_accounts';
import WeatherAccountsTable from '../../app/table-weather-account';
import { getSession } from 'next-auth/react';


export default function WeatherAccountsPage({ accounts, searchParams }: { accounts: weatherAccount[], searchParams: { q: string } }) {
  const searchTerm = searchParams.q || "";
  const filtered = (searchTerm.length > 0) ? accounts.filter((account) => {
    const contains = (original: string) => {
      if (!searchTerm) return true;
      return original.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return contains(account.api_key ?? "") || contains(account._id.toString());

  }) : accounts;
  //(VPN|OGPS|IGPS|IDB|ODB)



  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      <Title>Weather Accounts</Title>
      <Flex alignItems='end' flexDirection='row' className='mt-6'>
        <Search />
      </Flex>
      <div style={{ marginTop: '20px' }}>
        <Text >
          {filtered.length} accounts matching your search
        </Text>
      </div>

      <Card className="mt-6">
        <WeatherAccountsTable accounts={filtered} />
      </Card>
    </main>
  );

}

export async function getServerSideProps(context: any) {
  const session = await getSession(context);
  if ((!session || !session.user.admin ) && process.env.NODE_ENV !== 'development') {
    return {
      props: { error: 'Unauthorized access' },
    };
  }
  try {
    const client = await clientPromise;
    const db = client.db("main");

    const accounts = (await db
      .collection("weather_accounts")
      .find({})
      .toArray()).map((account) => {
        if(account.token) {
          account.token = account.token.substring(0, 20) + "..."
        }
        if(account.api_key) {
          account.api_key = account.api_key.substring(0, 20) + "..."
        }
        if(account.app_key) {
          account.app_key = account.app_key.substring(0, 20) + "..."
        }
        return account;
      });
    const searchParams = context.query;

    return {
      props: { accounts: JSON.parse(JSON.stringify(accounts)), searchParams },
    };
  } catch (e) {
    console.error(e);
  }
}
