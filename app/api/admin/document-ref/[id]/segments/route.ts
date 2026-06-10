// app/api/admin/documents/[id]/segments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const segments = await prisma.sourceDocumentSegment.findMany({
    where: { sourceDocumentid: params.id },
    orderBy: { createdAt: 'asc' },
    select: { content: true },
  });

  return NextResponse.json({
    segments: segments.map(s => s.content),
  });
}