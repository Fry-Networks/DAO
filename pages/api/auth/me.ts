import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth-options';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ authenticated: false, user: null });
  }

  return res.status(200).json({
    authenticated: true,
    user: {
      id: (session.user as any)?.id,
      name: session.user?.name,
      email: session.user?.email,
      image: session.user?.image,
      discordId: (session.user as any)?.discordId,
    },
  });
}
