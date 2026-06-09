"use client";

import { useChat } from '@ai-sdk/react';
import { useRef, useState, useMemo, useEffect, use } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/app-sidebar";
import { NavActions } from "@/components/nav-actions";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AlertDialogWithMedia } from "@/components/alert-dialog-with-media";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { DefaultChatTransport, createIdGenerator } from 'ai';
import type { UIMessage } from 'ai';

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isPending, error } = authClient.useSession();

  const chatId = useMemo(() => {
    return `chat_${data?.user?.id}`;
  }, [data?.user?.id]);

  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [chatTitle, setChatTitle] = useState('Nouvelle conversation');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/chat/${id}/messages`)
      .then(res => res.ok ? res.json() : [])
      .then((msgs: UIMessage[]) => setInitialMessages(msgs))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/chat/${id}/title`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.title) setChatTitle(data.title);
      })
      .catch(() => {});
  }, [id]);

  const handleTitleSave = async () => {
  if (!titleInput.trim()) {
    setIsEditingTitle(false);
    return;
  }
  setChatTitle(titleInput);
  setIsEditingTitle(false);
  await fetch(`/api/chat/${id}/title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: titleInput }),
  });
  // ✅ AJOUTÉ : notifier le sidebar de se rafraîchir
  window.dispatchEvent(new Event('chat-updated'));
};

  const { messages: chatMessages, sendMessage, status, error: chatError, stop } = useChat({
    id: id ?? chatId,
    generateId: createIdGenerator({
      prefix: 'msgc',
      size: 16,
    }),
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest({
        messages: msgs,
      }: {
        messages: UIMessage[];
        id: string;
      }) {
        return {
          body: {
            message: msgs[msgs.length - 1],
            id: id ?? chatId,
          },
        };
      },
    }),
  });

  const messages = chatMessages.length > 0
    ? chatMessages
    : initialMessages;

  if (isPending) {
    return <div className="flex items-center justify-center h-screen">Chargement...</div>;
  }

  if (!data || error) {
    router.push("/login");
    return null;
  }

  const renderPart = (part: UIMessage['parts'][number], index: number) => {
    if (part.type === 'text') {
      return (
        <div key={index} className="whitespace-pre-wrap">
          {part.text}
        </div>
      );
    }
    if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
      return (
        <div key={index} className="mt-2">
          <img
            src={part.url}
            alt={part.filename ?? 'Image'}
            className="max-w-full max-h-48 rounded-lg shadow-md object-contain"
          />
          <div className="text-xs mt-1 opacity-70">📎 {part.filename}</div>
        </div>
      );
    }
    if (part.type === 'file') {
      return (
        <div key={index} className="mt-2">
          <a
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            📎 {part.filename ?? 'Télécharger le fichier'}
          </a>
        </div>
      );
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() && (!files || files.length === 0)) return;
    
    sendMessage({ text: input, files });
    setInput('');
    setFiles(undefined);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="line-clamp-1">
                    {isEditingTitle ? (
                      <input
                        autoFocus
                        value={titleInput}
                        onChange={e => setTitleInput(e.target.value)}
                        onBlur={handleTitleSave}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleTitleSave();
                          if (e.key === 'Escape') setIsEditingTitle(false);
                        }}
                        className="bg-transparent border-b border-primary focus:outline-none text-sm w-48"
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setTitleInput(chatTitle);
                          setIsEditingTitle(true);
                        }}
                        className="cursor-pointer hover:underline"
                        title="Cliquer pour renommer"
                      >
                        {chatTitle}
                      </span>
                    )}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          
          <div className="ml-auto flex items-center gap-2 px-3">
            <span className="text-sm text-muted-foreground">
              {data?.user?.name} ({data?.user?.email})
            </span>
            <AlertDialogWithMedia />
            <NavActions />
            <Button variant="outline" size="sm" onClick={() => authClient.signOut()}>
              Déconnexion
            </Button>
          </div>
        </header>
        
        {/* Chat Section */}
        <div className="flex flex-col h-[calc(100vh-3.5rem)]">
          {/* Chat Header */}
          <div className="border-b px-6 py-4">
            <h2 className="text-xl font-semibold">Assistant IA</h2>
            <p className="text-sm text-muted-foreground">
              Posez vos questions ou partagez des fichiers
            </p>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground mt-20">
                <p className="text-lg">💬 Commencez une conversation !</p>
                <p className="text-sm mt-2">Vous pouvez aussi joindre des fichiers 📎</p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="px-4 py-2 border-b border-opacity-20">
                    <span className="font-semibold text-sm">
                      {message.role === 'user' ? '👤 Vous' : '🤖 Assistant'}
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    {message.parts.map((part, index) => renderPart(part, index))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        
          {/* Loading Status */}
          {(status === 'submitted' || status === 'streaming') && (
            <div className="mx-6 mb-4 flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">
                  {status === 'submitted' ? 'Envoi...' : "L'assistant écrit..."}
                </span>
              </div>
              <button 
                onClick={() => stop()} 
                className="text-destructive text-sm hover:underline"
              >
                Stop
              </button>
            </div>
          )}

          {/* Error Message */}
          {chatError && (
            <div className="mx-6 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-destructive text-sm">Erreur: {chatError.message}</p>
            </div>
          )}

          {/* Selected Files Preview */}
          {files && files.length > 0 && (
            <div className="mx-6 mb-2 flex gap-2 p-2 bg-muted rounded-lg overflow-x-auto">
              {Array.from(files).map((file, index) => (
                <div
                  key={index}
                  className="text-sm text-muted-foreground bg-background px-2 py-1 rounded shadow-sm whitespace-nowrap"
                >
                  📎 {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </div>
              ))}
            </div>
          )}

          {/* Input Form */}
          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex items-center gap-2 flex-1 border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-ring bg-background">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  📎
                </button>
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files) setFiles(e.target.files);
                  }}
                  multiple
                  ref={fileInputRef}
                  className="hidden"
                />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Tapez votre message..."
                  disabled={status !== 'ready'}
                  className="flex-1 bg-transparent focus:outline-none disabled:opacity-50"
                />
              </div>
              <Button
                type="submit"
                disabled={
                  status !== 'ready' ||
                  (!input.trim() && (!files || files.length === 0))
                }
              >
                Envoyer
              </Button>
            </form>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}