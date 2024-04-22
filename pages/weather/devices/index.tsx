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
import { deviceData, weatherAccount } from '../../../lib/weather_accounts';
import WeatherDevicesTable from '../../../app/table-weather-device';
import { getSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { Device } from '../../../lib/devices-schema';

export default function WeatherDevicesPage({
  accounts,
  searchParams
}: {
  accounts: weatherAccount[];
  searchParams: { q: string };
}) {
  const devices = accounts.flatMap(account =>
    account.devices.map(device => ({
      ...device,
      type: account.api_type ?? 'Unknown',  // Add default type if not present
    }))
  );
  const searchTerm = searchParams.q || '';

  const filteredDevices = useMemo(() => {
  
    return searchTerm.length > 0
      ? devices.filter(device => {
          const contains = (original: string) => {
            if (!original) return false;  // Ensure the original string is present
            return original.toLowerCase().includes(searchTerm.toLowerCase());
          };
          // Check device MAC and device info name for the search term
          return contains(device.deviceMAC) || contains(device.infos.name.toString());
        })
      : devices;  // Return all devices if no search term is present
  }, [searchTerm]); 
  //(VPN|OGPS|IGPS|IDB|ODB)

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      <Title>Weather Devices</Title>
      <Flex alignItems="end" flexDirection="row" className="mt-6">
        <Search />
      </Flex>
      <div style={{ marginTop: '20px' }}>
        <Text>{filteredDevices.length} devices matching your search</Text>
      </div>

      <Card className="mt-6">
        <WeatherDevicesTable devicesData={filteredDevices} />
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

  try {
    const client = await clientPromise;
    const db = client.db('main');

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
      props: { accounts: JSON.parse(JSON.stringify(accounts)), searchParams }
    };
  } catch (e) {
    console.error(e);
  }
}
