import { NextRequest, NextResponse } from 'next/server';
import { connect } from '../lib/connect';

export async function middleware(_request: NextRequest) {
  await connect();

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!login).*)',
};
