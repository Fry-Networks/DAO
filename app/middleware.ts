import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import { connect } from '../lib/connect';

export async function middleware(request: NextRequest) {
    console.log("middleware")
    console.log(request)
    await connect();
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.redirect('/login');
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!login).*)',
}
