// app/api/admin/document-ref/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
  }

  const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Format non supporté (PDF, TXT, MD uniquement)' }, { status: 400 });
  }

  // ✅ Vérifier que Python tourne
  try {
    const pythonFormData = new FormData();
    pythonFormData.append('file', file);

    const response = await fetch('http://localhost:8000/upload', {
      method: 'POST',
      body: pythonFormData,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Python error:', error);
      return NextResponse.json({ error: error.detail || "Erreur lors de l'indexation" }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (err: any) {
    // ✅ Affiche l'erreur exacte dans la console Next.js
    console.error('Upload fetch error:', err.message);

    if (err.message?.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Le microservice Python est arrêté. Lance uvicorn sur le port 8000.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}