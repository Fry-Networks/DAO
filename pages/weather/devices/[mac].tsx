import {
  Card,
  Metric,
  Text,
  Title,
  BarList,
  Flex,
  Grid,
  MultiSelect,
  MultiSelectItem
} from '@tremor/react';
import Search from '../../../app/search';
import clientPromise from '../../../lib/mongoclient';
import { weatherAccount } from '../../../lib/weather_accounts';
import WeatherDevicesTable from '../../../app/table-weather-device';
import { getSession } from 'next-auth/react';
import WeatherDeviceData from '../../../app/table-weather-data';

export default function WeatherDataPage({
  weather_data,
  searchParams
}: {
  weather_data: any;
  searchParams: { q: string };
}) {
  const searchTerm = searchParams.q || '';
  const weathers = weather_data.map((weather: any) => weather).flat();

  console.log(weathers, 'waether data');

  //   const filtered =
  //     searchTerm.length > 0
  //       ? weathers.filter((device) => {
  //           const contains = (original: string) => {
  //             if (!searchTerm) return true;
  //             return original.toLowerCase().includes(searchTerm.toLowerCase());
  //           };
  //           return (
  //             contains(device.deviceMAC ?? '') ||
  //             contains(device.infos.name.toString())
  //           );
  //         })
  //       : devices;
  //(VPN|OGPS|IGPS|IDB|ODB)

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      <Title>Device Data</Title>
      {/* <Flex alignItems="end" flexDirection="row" className="mt-6">
        <Search />
      </Flex> */}
      <div style={{ marginTop: '20px' }}>
        <Text>{weathers?.length} data matching your device MAC address</Text>
      </div>

      <Card className="mt-6">
        <WeatherDeviceData weathers={weathers} />
      </Card>
    </main>
  );
}

export async function getServerSideProps(context: any) {
  const session = await getSession(context);
  if ((!session || !session.user.admin ) && process.env.NODE_ENV !== 'development') {
    return {
      props: { error: 'Unauthorized access' }
    };
  }

  console.log(context.query?.mac, 'mac');

  try {
    const client = await clientPromise;
    const db = client.db('main');

    const weather_data = await db
      .collection('weathers')
      .find({ 'metadata.deviceMAC': context.query?.mac })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    const searchParams = context.query;

    return {
      props: {
        weather_data: JSON.parse(JSON.stringify(weather_data)),
        searchParams
      }
    };
  } catch (e) {
    console.error(e);
  }
}
