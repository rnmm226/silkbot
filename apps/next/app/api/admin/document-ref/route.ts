import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireAdmin(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  return null;
}

function getDocumentLabel(content: string | null, id: string) {
  const firstLine = content?.split(/\r?\n/).find((line) => line.trim());
  const label = firstLine?.trim() || `Document ${id.slice(0, 8)}`;

  return label.length > 90 ? `${label.slice(0, 87).trim()}...` : label;
}

// GET — liste tous les documents
export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const documents = await prisma.sourceDocument.findMany({
    include: {
      _count: { select: { segments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(
    documents.map(doc => ({
      id: doc.id,
      filename: getDocumentLabel(doc.content, doc.id),
      segmentCount: doc._count.segments,
      createdAt: doc.createdAt,
    }))
  );
}

// DELETE — supprime un document et ses segments
export async function DELETE(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { id } = await req.json();
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }

  await prisma.sourceDocumentSegment.deleteMany({
    where: { sourceDocumentid: id },
  });

  await prisma.sourceDocument.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
