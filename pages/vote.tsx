import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function VotePage() {
  const router = useRouter();
  useEffect(() => { router.replace('/votes?tab=active'); }, [router]);
  return null;
}
