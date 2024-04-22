import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Text,
  Button
} from '@tremor/react';
import Link from 'next/link';
import { webUser } from '../lib/webusers-model';
import { User } from '../lib/users-schema';
import { Device } from '../lib/devices-schema';
import { deviceData, weatherAccount } from '../lib/weather_accounts';
import { WeatherData } from '../lib/weather-schema';
import { useRouter } from 'next/router';
export default function WeatherDeviceData({ weathers }: { weathers: any }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Temperature</TableHeaderCell>
          <TableHeaderCell>TempF</TableHeaderCell>
          <TableHeaderCell>Humidity</TableHeaderCell>
          <TableHeaderCell>HumidityIn</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {weathers?.map((weat: any, ind: number) => (
          <TableRow key={ind}>
            <TableCell>
              <Text>{new Date(weat?.timestamp)?.toDateString()}</Text>
            </TableCell>
            <TableCell>
              <Text>{weat?.temperature}</Text>
            </TableCell>
            <TableCell>
              <Text>{weat?.tempf}</Text>
            </TableCell>
            <TableCell>
              <Text>{weat?.humidity}</Text>
            </TableCell>
            <TableCell>
              <Text>{weat?.humidityin}</Text>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
