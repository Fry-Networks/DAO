import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AllVotesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/votes?tab=all'); }, [router]);
  return null;
}
