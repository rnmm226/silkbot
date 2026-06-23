// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { generateId } from 'ai';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const chatId = formData.get('chatId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validation de la taille
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` 
      }, { status: 400 });
    }

    // Validation du type MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: 'File type not allowed. Please upload PDF, DOC, DOCX, or TXT files.' 
      }, { status: 400 });
    }

    // Générer un nom de fichier unique
    const fileId = generateId();
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${fileId}-${safeFileName}`;
    
    // Chemin de sauvegarde
    const uploadDir = join(process.cwd(), 'uploads', session.user.id);
    
    // Créer le dossier s'il n'existe pas
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const filePath = join(uploadDir, fileName);
    
    // Convertir le fichier en Buffer et le sauvegarder
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Sauvegarder les métadonnées dans la base de données
    // (vous devrez créer un modèle File dans votre schema Prisma)
    // const fileRecord = await prisma.file.create({
    //   data: {
    //     id: fileId,
    //     name: file.name,
    //     size: file.size,
    //     type: file.type,
    //     path: filePath,
    //     chatId: chatId || null,
    //     userId: session.user.id,
    //   },
    // });

    return NextResponse.json({ 
      success: true,
      fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: `/api/upload/${fileId}`,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// Route pour récupérer un fichier
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    
    // Récupérer les métadonnées du fichier depuis la base de données
    // const file = await prisma.file.findUnique({
    //   where: { id },
    // });

    // if (!file || file.userId !== session.user.id) {
    //   return NextResponse.json({ error: 'File not found' }, { status: 404 });
    // }

    // Lire le fichier
    // const fileBuffer = await readFile(file.path);
    
    // return new NextResponse(fileBuffer, {
    //   headers: {
    //     'Content-Type': file.type,
    //     'Content-Disposition': `inline; filename="${file.name}"`,
    //   },
    // });

    return NextResponse.json({ error: 'Not implemented' }, { status: 501 });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}