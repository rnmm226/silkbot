// app/api/account/has-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ hasCredentialAccount: false, provider: null }, { status: 401 });
  }

  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { providerId: true },
  });

  const hasCredentialAccount = accounts.some(a => a.providerId === 'credential');
  const otherProvider = accounts.find(a => a.providerId !== 'credential')?.providerId ?? null;

  return NextResponse.json({
    hasCredentialAccount,
    provider: hasCredentialAccount ? null : otherProvider,
  });
}