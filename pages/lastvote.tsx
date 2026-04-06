import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function LastVotePage() {
  const router = useRouter();
  useEffect(() => { router.replace('/votes?tab=recent'); }, [router]);
  return null;
}
