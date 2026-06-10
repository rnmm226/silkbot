// app/api/admin/documents/route.ts
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
      filename: doc.content,
      segmentCount: doc._count.segments,
      createdAt: doc.createdAt,
    }))
  );
}

// PATCH — renommer un document
export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { id, filename } = await req.json();

  if (!id || !filename?.trim()) {
    return NextResponse.json({ error: 'ID et nom requis' }, { status: 400 });
  }

  const updated = await prisma.sourceDocument.update({
    where: { id },
    data: { content: filename.trim() },
  });

  return NextResponse.json({ success: true, id: updated.id, filename: updated.content });
}

// DELETE — supprime un document et ses segments
export async function DELETE(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { id } = await req.json();

  await prisma.sourceDocumentSegment.deleteMany({
    where: { sourceDocumentid: id },
  });

  await prisma.sourceDocument.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}