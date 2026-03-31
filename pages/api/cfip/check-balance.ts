import type { NextApiRequest, NextApiResponse } from 'next';
import { checkFryBalance } from '../../../lib/fry-balance';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Address is required' });
  }

  // Basic Algorand address validation
  if (!/^[A-Z2-7]{58}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid Algorand address' });
  }

  try {
    const result = await checkFryBalance(address);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Balance check failed:', error);
    return res.status(500).json({ error: 'Failed to check balance' });
  }
}
