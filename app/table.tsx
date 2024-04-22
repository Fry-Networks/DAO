import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Text
} from '@tremor/react';
import { webUser } from '../lib/webusers-model';
import { User } from '../lib/users-schema';

export default function UsersTable({ users }: { users: User[] }) {
  const sorted = users.sort((a, b) => {
    // Check if both have full names
    if (a.name?.full && b.name?.full) {
        // If both have full names, then check the address
        if (a.address && !b.address) {
            return -1;
        } else if (!a.address && b.address) {
            return 1;
        } else {
            return 0;
        }
    } 
    // If one has a full name and the other doesn't, give priority to the one with a full name
    else if (a.name?.full && !b.name?.full) {
        return -1;
    } else if (!a.name?.full && b.name?.full) {
        return 1;
    } 
    // If neither have a full name, then check the address
    else {
        if (a.address && !b.address) {
            return -1;
        } else if (!a.address && b.address) {
            return 1;
        } else {
            return 0;
        }
    }
});



  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Address</TableHeaderCell>
          <TableHeaderCell>Email</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sorted.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.name?.full ?? ""}</TableCell>
            <TableCell>
              <Text>{user.address}</Text>
            </TableCell>
            <TableCell>
              <Text>{user.email}</Text>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
