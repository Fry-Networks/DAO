import { Title, Text } from '@tremor/react';

export default async function Loading() {
  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      <Title className="text-white">DAO</Title>
      <Text className="text-[#999999]">
        Loading...
      </Text>
      <div className="w-full mt-6 bg-[#1e1e1e] border border-[#333333] rounded-lg h-[360px] animate-pulse" />
    </main>
  );
}
