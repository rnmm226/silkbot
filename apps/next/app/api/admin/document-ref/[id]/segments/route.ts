// app/api/admin/document-ref/route.ts
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
  try {
    const firstLine = content?.split(/\r?\n/).find((line) => line.trim());
    const label = firstLine?.trim() || `Document ${id.slice(0, 8)}`;
    return label.length > 90 ? `${label.slice(0, 87).trim()}...` : label;
  } catch {
    return `Document ${id.slice(0, 8)}`;
  }
}

// GET — liste tous les documents
export async function GET(req: NextRequest) {
  try {
    const authError = await requireAdmin(req);
    if (authError) return authError;

    // Récupérer les documents avec leurs segments
    const documents = await prisma.sourceDocument.findMany({
      include: {
        _count: { 
          select: { 
            SourceDocumentSegment: true  // Correction: utiliser le nom exact du modèle
          } 
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Transformer les données
    const result = documents.map(doc => ({
      id: doc.id,
      filename: getDocumentLabel(doc.content, doc.id),
      segmentCount: doc._count?.SourceDocumentSegment || 0, // Correction: utiliser _count
      createdAt: doc.created_at,
      content: doc.content, // Optionnel: pour debug
    }));

    // Toujours retourner un tableau, même vide
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("Erreur GET documents:", error);
    // Retourner un tableau vide en cas d'erreur
    return NextResponse.json([]);
  }
}

// DELETE — supprime un document et ses segments
export async function DELETE(req: NextRequest) {
  try {
    const authError = await requireAdmin(req);
    if (authError) return authError;

    const body = await req.json();
    const { id } = body;
    
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
    }

    // Supprimer d'abord les segments
    await prisma.sourceDocumentSegment.deleteMany({
      where: { sourceDocumentid: id },
    });

    // Puis supprimer le document
    await prisma.sourceDocument.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Erreur DELETE document:", error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}