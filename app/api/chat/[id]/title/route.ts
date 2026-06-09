import { NextRequest, NextResponse } from 'next/server';
import { updateConversationTitle } from '@/util/chat-store';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chat = await prisma.chat.findUnique({
    where: { id },
    select: { title: true },
  });
  return NextResponse.json({ title: chat?.title ?? 'Nouvelle conversation' });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { title } = await req.json();
  await updateConversationTitle(id, title);
  return NextResponse.json({ success: true });
}