// app/api/admin/document-ref/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireAdmin(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    return null;
  } catch (error) {
    console.error("Erreur d'authentification:", error);
    return NextResponse.json({ error: 'Erreur d\'authentification' }, { status: 401 });
  }
}

function getDocumentLabel(content: string | null, id: string) {
  try {
    if (content) {
      const firstLine = content.split(/\r?\n/).find((line) => line.trim());
      if (firstLine) {
        const label = firstLine.trim();
        return label.length > 90 ? `${label.slice(0, 87).trim()}...` : label;
      }
    }
    return `Document ${id.slice(0, 8)}`;
  } catch {
    return `Document ${id.slice(0, 8)}`;
  }
}

// GET — liste tous les documents
export async function GET(req: NextRequest) {
  try {
    console.log("🔍 GET /api/admin/document-ref - Début");
    
    const authError = await requireAdmin(req);
    if (authError) return authError;

    console.log("🔍 Recherche des documents dans la base de données...");
    
    // Récupérer les documents
    const documents = await prisma.sourceDocument.findMany({
      include: {
        _count: { 
          select: { 
            SourceDocumentSegment: true 
          } 
        },
      },
      orderBy: { created_at: 'desc' },
    });

    console.log(`📄 ${documents.length} documents trouvés`);

    // Transformer les données
    const result = documents.map(doc => ({
      id: doc.id,
      filename: getDocumentLabel(doc.content, doc.id),
      segmentCount: doc._count?.SourceDocumentSegment || 0,
      createdAt: doc.created_at ? doc.created_at.toISOString() : new Date().toISOString(),
    }));

    console.log("✅ Réponse envoyée avec succès");
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("❌ Erreur GET documents:", error);
    // Retourner un tableau vide en cas d'erreur
    return NextResponse.json([], { status: 200 });
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
    console.error("❌ Erreur DELETE document:", error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}