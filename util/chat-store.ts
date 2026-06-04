import { generateId, UIMessage } from 'ai';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

function getChatFile(id: string): string {
  const chatDir = path.join(process.cwd(), '.chats');
  if (!existsSync(chatDir)) {
    mkdirSync(chatDir, { recursive: true });
  }
  return path.join(chatDir, `${id}.json`);
}

export async function createChat(): Promise<string> {
  const id = generateId();
  await writeFile(getChatFile(id), '[]', 'utf8');
  return id;
}

export async function loadChat(id: string): Promise<UIMessage[]> {
  const raw = await readFile(getChatFile(id), 'utf8');
  return JSON.parse(raw) as UIMessage[];
}

export async function saveChat({
  chatId,
  messages,
}: {
  chatId: string;
  messages: UIMessage[];
}): Promise<void> {
  await writeFile(
    getChatFile(chatId),
    JSON.stringify(messages, null, 2),
    'utf8'
  );
}