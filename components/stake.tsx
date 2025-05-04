import { Button, Divider, Flex, Text, Title } from '@tremor/react';
import { Stake } from '../lib/stake-schema';
import { useEffect, useState } from 'react';
import { useWallet } from '@txnlab/use-wallet';

interface TimeLeft {
  totalMilliseconds: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const testMode = process.env.NEXT_PUBLIC_TEST === 'true' ? true : false;

export default function StakeItem({
  stake,
  handleMessage
}: {
  stake: Stake;
  handleMessage: (success: boolean, message: string) => void;
}) {
  const { activeAccount } = useWallet();
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function addSixMonths(date: Date) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 6);
    return result;
  }

  function addOneDay(date: Date) {
    const result = new Date(date);
    result.setDate(result.getDate() + 1);
    return result;
  }

  function calculateTimeLeft() {
    const now = new Date();
    const goalTime = testMode
      ? addOneDay(new Date(stake.end_date))
      : addSixMonths(new Date(stake.end_date));
    console.log(goalTime);
    const difference = goalTime.getTime() - now.getTime();
    if (difference <= 0) {
      return {
        totalMilliseconds: 0,
        months: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      };
    }

    // Roughly calculate months and days (simple version)
    const msInDay = 1000 * 60 * 60 * 24;
    const daysTotal = Math.floor(difference / msInDay);

    const months = Math.floor(daysTotal / 30); // Approximate: 1 month ≈ 30 days
    const days = daysTotal % 30;

    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((difference / (1000 * 60)) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    return {
      totalMilliseconds: difference,
      months,
      days,
      hours,
      minutes,
      seconds
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [stake]);

  async function handleWithdraw() {
    if (!activeAccount) {
      console.log('Wallet is not connected');
      return;
    }

    try {
      const response = await fetch('/api/withdraw-stake', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address: activeAccount.address, data: stake })
      });

      if (!response.ok) {
        console.log('Failed to withdraw');
        handleMessage(false, 'Internal server error');
        return;
      }

      const result = await response.json();
      if (result.success) {
        console.log('TxId', result.message);
        handleMessage(true, 'Withdraw success: ' + result.message);
        return;
      }

      handleMessage(false, result.message);
      console.log('Failed to withdraw the staked tokens');
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="w-full p-4 border-green-700 border-2 rounded-2xl">
      <Title className="w-full">{stake.voteTitle}</Title>
      <Divider className="mt-1 mb-2" />
      <Text>Option: {Number(stake.option) + 1}</Text>
      <Text className="mt-2">
        Staked {stake.stakes} for {stake.votes} votes
      </Text>
      <Flex>
        {timeLeft.totalMilliseconds > 24 * 60 * 60 * 1000 ? (
          <Text>
            {timeLeft.months} months {timeLeft.days} days left to withdraw
          </Text>
        ) : (
          <Text>
            {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s days to
            withdraw
          </Text>
        )}
        <Button
          disabled={
            timeLeft.months > 0 ||
            timeLeft.days > 0 ||
            timeLeft.hours > 0 ||
            timeLeft.minutes > 0 ||
            timeLeft.seconds > 0
          }
          onClick={() => handleWithdraw()}
        >
          Withdraw
        </Button>
      </Flex>
    </div>
  );
}
