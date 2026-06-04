'use client';

import { useChat } from '@ai-sdk/react';
import { type UIMessage } from 'ai';

export function Chat({
  chatData,
  resume = false,
}: {
  chatData: {
    id: string;
    messages: UIMessage[];
    activeStreamId?: string | null;
  };
  resume?: boolean;
}) {
  const chat = useChat({
    id: chatData.id,
    messages: chatData.messages,
    resume,
  });

  const stop = () => {
    const lastMessage = chat.messages[chat.messages.length - 1];
    const assistantMessage =
      lastMessage?.role === 'assistant' ? lastMessage : undefined;

    void fetch(`/api/chat/${chatData.id}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        assistantMessage || chatData.activeStreamId
          ? {
              assistantMessage,
              activeStreamId: chatData.activeStreamId,
            }
          : {},
      ),
    });

    void chat.stop();
  };

  return <button onClick={stop}>Stop</button>;
}