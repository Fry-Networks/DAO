import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Text
} from '@tremor/react';
import Link from 'next/link';
import { webUser } from '../lib/webusers-model';
import { User } from '../lib/users-schema';
import { Device } from '../lib/devices-schema';
import { weatherAccount } from '../lib/weather_accounts';
export default function WeatherAccountsTable({ accounts }: { accounts: weatherAccount[] }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Type</TableHeaderCell>
          <TableHeaderCell>Api Key / Token</TableHeaderCell>
          <TableHeaderCell>Devices</TableHeaderCell>
          <TableHeaderCell>User ID</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {accounts.map((account) => (
          <TableRow key={account.id}>
            <TableCell>{account.api_type}</TableCell>
            <TableCell>{account.api_key ?? account.token}</TableCell>
            <TableCell>
              <Text>{account.devices.length}</Text>
            </TableCell>
            <TableCell>
              <Link href="/users?q=[id]" as={`/users?q=${account.user_id}`}>
                <Text>{account.user_id.toString()}</Text>
              </Link>

            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
