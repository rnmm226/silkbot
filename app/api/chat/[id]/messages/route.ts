import { NextRequest, NextResponse } from 'next/server';
import { getConversationMessages } from '@/util/chat-store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messages = await getConversationMessages(id);
  return NextResponse.json(messages);
}