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
import { AirAccount } from '../lib/air_accounts';
import { Fragment } from 'react';
export default function AirAccountsTable({ accounts }: { accounts: AirAccount[] }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Type</TableHeaderCell>
          <TableHeaderCell>Data</TableHeaderCell>
          <TableHeaderCell>Devices</TableHeaderCell>
          <TableHeaderCell>User ID</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {accounts.map((account) => (
          <TableRow key={account.id}>
            <TableCell>{account.api_type}</TableCell>
            <TableCell>
            {[
    { key: 'API Key', value: account.api_key },
    { key: 'Read Key', value: account.read_key },
    { key: 'Sensor', value: account.sensor },
    { key: 'Owner', value: account.owner },
    { key: 'IMEI', value: account.imei },
  ].filter(item => Boolean(item.value)).map((item, index, arr) => (
    <Fragment key={index}>
      <span>{item.key}: {item.value}</span>
      {index < arr.length - 1 && <br />}
    </Fragment>
  ))}
            </TableCell>
            <TableCell>
              <Text>{account.devices?.length ?? "No devices"}</Text>
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
