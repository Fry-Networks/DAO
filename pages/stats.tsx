import { useEffect, useState } from 'react';
import { Card, Title, Text, Grid, Metric } from '@tremor/react';

interface GovernanceStats {
  votes: {
    total: number;
    active: number;
    completed: number;
    contractBased: number;
    withParticipation: number;
  };
  participation: {
    uniqueVoters: number;
    totalFryStaked: number;
  };
  cfips: {
    total: number;
    byStatus: Record<string, number>;
  };
  stakes: {
    v1Count: number;
  };
}

function StatCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
      <Text className="text-[var(--text-secondary)]">{title}</Text>
      <Metric className="text-[var(--text-heading)] mt-1">{value}</Metric>
      {subtitle && <Text className="text-[var(--text-secondary)] text-sm mt-1">{subtitle}</Text>}
    </Card>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<GovernanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/governance-stats')
      .then(res => res.ok ? res.json() : Promise.reject('Failed to load'))
      .then(setStats)
      .catch(e => setError(e.toString()))
      .finally(() => setLoading(false));
  }, []);

  const formatNumber = (n: number) => n.toLocaleString();

  if (loading) {
    return (
      <main className="p-4 md:p-10 mx-auto max-w-7xl">
        <Title className="text-[var(--text-heading)] mb-6">Governance Stats</Title>
        <Text className="text-[var(--text-secondary)]">Loading...</Text>
      </main>
    );
  }

  if (error || !stats) {
    return (
      <main className="p-4 md:p-10 mx-auto max-w-7xl">
        <Title className="text-[var(--text-heading)] mb-6">Governance Stats</Title>
        <Text className="text-rose-500">Failed to load statistics</Text>
      </main>
    );
  }

  const cfipStatusStr = Object.entries(stats.cfips.byStatus)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      <Title className="text-[var(--text-heading)] mb-6">Governance Stats</Title>
      
      <Grid numItemsSm={2} numItemsLg={3} className="gap-4">
        <StatCard 
          title="Total Votes" 
          value={stats.votes.total}
          subtitle={`${stats.votes.active} active, ${stats.votes.completed} completed`}
        />
        <StatCard 
          title="Contract Votes (V2)" 
          value={stats.votes.contractBased}
        />
        <StatCard 
          title="Unique Voters" 
          value={formatNumber(stats.participation.uniqueVoters)}
        />
        <StatCard 
          title="Total FRY Staked" 
          value={formatNumber(stats.participation.totalFryStaked)}
        />
        <StatCard 
          title="Community Proposals" 
          value={stats.cfips.total}
          subtitle={cfipStatusStr}
        />
        <StatCard 
          title="Legacy Stakes (V1)" 
          value={stats.stakes.v1Count}
        />
      </Grid>
    </main>
  );
}
