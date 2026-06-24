// app/api/pdfs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Mapping source -> dossier
const SOURCE_FOLDERS: Record<string, string> = {
  'jort': 'downloaded_jort_pdfs',
  'jibaya': 'downloaded_pdfs',
  'luca_pacioli': 'downloaded_pacioli_pdfs',
};

/**
 * Recherche récursive d'un fichier PDF dans un dossier
 */
function findPdfRecursive(dir: string, filename: string): string | null {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const found = findPdfRecursive(fullPath, filename);
        if (found) return found;
      } else if (file === filename) {
        return fullPath;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page');

    if (!id) {
      return new NextResponse('ID manquant', { status: 400 });
    }

    // 1. Récupérer les métadonnées du document
    const result = await pool.query(
      `SELECT id, filename, source, source_url, content 
       FROM "SourceDocument" 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return new NextResponse('Document non trouvé', { status: 404 });
    }

    const doc = result.rows[0];

    // 2. Vérifier si le contenu est stocké en BLOB (PDF brut)
    if (doc.content && typeof doc.content === 'string' && doc.content.startsWith('%PDF')) {
      return new NextResponse(doc.content, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${doc.filename}"`,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // 3. Sinon, lire le fichier physique
    const baseFolder = SOURCE_FOLDERS[doc.source] || 'pdfs';
    let filePath = path.join(process.cwd(), baseFolder, doc.filename);

    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      // Rechercher récursivement
      const found = findPdfRecursive(path.join(process.cwd(), baseFolder), doc.filename);
      if (found) {
        filePath = found;
      } else {
        // Essayer de trouver dans le dossier courant
        const currentFound = findPdfRecursive(process.cwd(), doc.filename);
        if (currentFound) {
          filePath = currentFound;
        } else {
          return new NextResponse(`Fichier PDF non trouvé: ${doc.filename}`, { status: 404 });
        }
      }
    }

    const buffer = fs.readFileSync(filePath);
    
    // Si une page est spécifiée, ajouter un paramètre d'ancrage
    const contentDisposition = page 
      ? `inline; filename="${doc.filename}"`
      : `inline; filename="${doc.filename}"`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'public, max-age=86400',
        ...(page ? { 'X-Page-Number': page } : {}),
      },
    });

  } catch (error) {
    console.error('Erreur PDF:', error);
    return new NextResponse('Erreur serveur', { status: 500 });
  }
}