import { readChat } from '@/util/chat-store';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const chat = await readChat(id);

    if (!chat) {
      return NextResponse.json({ messages: [] });
    }

    if (chat.userId && chat.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      id: chat.id,
      title: chat.title,
      messages: chat.messages || [],
    });
  } catch (error) {
    console.error('Error reading chat:', error);
    return NextResponse.json({ messages: [] });
  }
}
