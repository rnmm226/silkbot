// lib/streaming-state.ts
// Simple in-memory store for a single page/chat
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

// Optional: Clean up old streams after a timeout
setInterval(() => {
  // Implement cleanup logic if needed
}, 1000 * 60 * 5); // Clean every 5 minutes