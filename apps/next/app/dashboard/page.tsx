import { redirect } from 'next/navigation';
import { createChat } from '@/util/chat-store';

export default async function DashboardPage(): Promise<never> {
  const id = await createChat();
  redirect(`/dashboard/${id}`);
}