import { readChat, saveChat } from '@util/chat-store';
import { type UIMessage } from 'ai';

type StopRequest = {
  activeStreamId?: string | null;
  assistantMessage?: UIMessage;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const chat = await readChat(id);

  if (chat.activeStreamId == null) {
    return Response.json({ success: true });
  }

  const activeStreamId = chat.activeStreamId;
  const body = (await req.json().catch(() => ({}))) as StopRequest;

  if (
    body.activeStreamId != null &&
    body.activeStreamId !== activeStreamId
  ) {
    return Response.json({ success: true });
  }

  if (body.assistantMessage) {
    await saveAssistantSnapshot({
      chatId: id,
      message: body.assistantMessage,
    });
  }

  await markStreamAsStopped(activeStreamId);
  await cancelActiveWork(activeStreamId);

  const latestChat = await readChat(id);
  if (latestChat.activeStreamId === activeStreamId) {
    await saveChat({ id, activeStreamId: null });
  }

  return Response.json({ success: true });
}