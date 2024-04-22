import {
  Card,
  Metric,
  Text,
  Title,
  BarList,
  Flex,
  Grid,
  MultiSelect,
  MultiSelectItem,
  TabPanel,
  TabPanels,
  TabGroup,
  TabList,
  Tab
} from '@tremor/react';
import Search from '../app/search';
import clientPromise from '../lib/mongoclient';
import { useState } from 'react';
import { User } from '../lib/users-schema';
import UsersTable from '../app/table';
import { getSession } from 'next-auth/react';
import UserForm from '../components/form-user';
import RemoveUserForm from '../components/remove-user';

export default function UsersPage({
  users,
  searchParams
}: {
  users: User[];
  searchParams: { q: string };
}) {
  const searchTerm = searchParams.q || '';

  const filtered =
    searchTerm.length > 0
      ? users.filter((user) => {
          const contains = (original: string) => {
            if (!searchTerm) return true;
            return original.toLowerCase().includes(searchTerm.toLowerCase());
          };
          return (
            contains(user.name?.full ?? '') ||
            contains(user.address) ||
            contains(user.email) ||
            contains(user._id.toString())
          );
        })
      : users;
  //(VPN|OGPS|IGPS|IDB|ODB)

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      <Title>Users</Title>
      <TabGroup>
        <TabList className="mt-8">
          <Tab>List</Tab>
          <Tab>Add User</Tab>
          <Tab>Remove User</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Flex alignItems="end" flexDirection="row" className="mt-6">
              <Search />
            </Flex>
            <div style={{ marginTop: '20px' }}>
              <Text>{filtered.length} users matching your search</Text>
            </div>

            <Card className="mt-6">
              <UsersTable users={filtered} />
            </Card>
          </TabPanel>
          <TabPanel>
            <UserForm />
          </TabPanel>
          <TabPanel>
            <RemoveUserForm users={users} />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </main>
  );
}

export async function getServerSideProps(context: any) {
  const session = await getSession(context);
  if (!session || !session.user.admin) {
    return {
      props: { error: 'Unauthorized access' }
    };
  }
  try {
    const client = await clientPromise;
    const db = client.db('main');

    const users = await db.collection('users').find({}).toArray();
    const searchParams = context.query;

    return {
      props: { users: JSON.parse(JSON.stringify(users)), searchParams }
    };
  } catch (e) {
    console.error(e);
  }
}
