// app/api/admin/documents/upload/route.ts
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

  // Envoie le fichier au microservice Python pour indexation
  const pythonFormData = new FormData();
  pythonFormData.append('file', file);

  const response = await fetch('http://localhost:8002/upload', {
    method: 'POST',
    body: pythonFormData,
  });

  if (!response.ok) {
    const error = await response.json();
    return NextResponse.json({ error: error.detail || 'Erreur lors de l\'indexation' }, { status: 500 });
  }

  const result = await response.json();
  return NextResponse.json(result);
}