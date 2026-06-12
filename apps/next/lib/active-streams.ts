// lib/active-streams.ts
const activeStreams = new Map<string, string>();

export function setActiveStream(chatId: string, streamId: string | null) {
  if (streamId === null) {
    activeStreams.delete(chatId);
  } else {
    activeStreams.set(chatId, streamId);
  }
}

export function getActiveStream(chatId: string): string | null {
  return activeStreams.get(chatId) || null;
}