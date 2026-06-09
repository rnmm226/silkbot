"use client";

import { useChat } from '@ai-sdk/react';
import { useRef, useState, useMemo, useEffect, use } from 'react';
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
import { Send, Paperclip, Square, Pencil } from 'lucide-react';

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isPending, error } = authClient.useSession();

  const chatId = useMemo(() => `chat_${data?.user?.id}`, [data?.user?.id]);

  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [chatTitle, setChatTitle] = useState('Nouvelle conversation');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      .then(d => { if (d?.title) setChatTitle(d.title); })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleTitleSave = async () => {
    if (!titleInput.trim()) { setIsEditingTitle(false); return; }
    setChatTitle(titleInput);
    setIsEditingTitle(false);
    await fetch(`/api/chat/${id}/title`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleInput }),
    });
    window.dispatchEvent(new Event('chat-updated'));
  };

  const { messages: chatMessages, sendMessage, status, error: chatError, stop } = useChat({
    id: id ?? chatId,
    generateId: createIdGenerator({ prefix: 'msgc', size: 16 }),
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest({ messages: msgs }: { messages: UIMessage[]; id: string }) {
        return { body: { message: msgs[msgs.length - 1], id: id ?? chatId } };
      },
    }),
  });

  const messages = chatMessages.length > 0 ? chatMessages : initialMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isPending && (!data || error)) {
      router.replace("/login");
    }
  }, [data, error, isPending, router]);

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground font-light tracking-wide">Chargement…</span>
        </div>
      </div>
    );
  }

  if (!data || error) return null;

  const renderPart = (part: UIMessage['parts'][number], index: number) => {
    if (part.type === 'text') {
      return (
        <div key={index} className="whitespace-pre-wrap leading-relaxed text-sm">
          {part.text}
        </div>
      );
    }
    if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
      return (
        <div key={index} className="mt-2">
          <img src={part.url} alt={part.filename ?? 'Image'}
            className="max-w-full max-h-48 rounded-lg object-contain" />
          <div className="text-xs mt-1 opacity-50 font-light">📎 {part.filename}</div>
        </div>
      );
    }
    if (part.type === 'file') {
      return (
        <div key={index} className="mt-2">
          <a href={part.url} target="_blank" rel="noopener noreferrer"
            className="text-accent hover:underline text-sm">
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
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
  };

  const initials = data?.user?.name
    ?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>

        {/* ── Header ── */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background/80 backdrop-blur-sm px-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0" />
          <Separator orientation="vertical" className="h-4 opacity-30 data-vertical:h-4 data-vertical:self-auto" />

          <Breadcrumb className="flex-1 min-w-0">
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
                      className="bg-transparent border-b border-accent focus:outline-none text-sm w-52 font-sans text-foreground"
                    />
                  ) : (
                    <button
                      onClick={() => { setTitleInput(chatTitle); setIsEditingTitle(true); }}
                      className="flex items-center gap-1.5 group hover:text-foreground text-foreground/70 transition-colors"
                      title="Renommer la conversation"
                    >
                      <span className="font-medium text-sm font-sans truncate max-w-[200px]">{chatTitle}</span>
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
                    </button>
                  )}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <span className="hidden sm:block text-xs text-muted-foreground font-light">
              {data?.user?.name}
            </span>
            <AlertDialogWithMedia />
            <NavActions />
            <Button
              variant="outline"
              size="sm"
              onClick={() => authClient.signOut()}
              className="text-xs h-7 border-border/50 hover:border-border font-normal"
            >
              Déconnexion
            </Button>
          </div>
        </header>

        {/* ── Chat layout ── */}
        <div className="flex flex-col h-[calc(100vh-3.5rem)]">

          {/* ── Chat sub-header ── */}
          <div className="border-b border-border/30 px-6 py-3 flex items-center gap-3 bg-background">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm text-primary">⚖</span>
            </div>
            <div>
              <h2 className="font-serif text-base font-semibold text-foreground leading-tight">
                Assistant SilkBot
              </h2>
              <p className="text-[11px] text-muted-foreground font-light">
                Posez vos questions juridiques — réponses sourcées sur le droit tunisien
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[11px] text-muted-foreground font-light">En ligne</span>
            </div>
          </div>

          {/* ── Messages area ── */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">

            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div
                  className="w-12 h-12 rounded-xl bg-primary/8 border border-border/50 flex items-center justify-center mb-4"
                  style={{ animation: 'floatSlow 6s ease-in-out infinite' }}
                >
                  <span className="text-xl">⚖</span>
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-1">
                  Bonjour{data?.user?.name ? `, ${data.user.name.split(' ')[0]}` : ''} 👋
                </h3>
                <p className="text-sm text-muted-foreground font-light max-w-xs leading-relaxed">
                  Posez votre question juridique. Je vous réponds avec des sources officielles tunisiennes.
                </p>
                {/* Suggestion chips */}
                <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-sm">
                  {[
                    "Comment créer une SARL ?",
                    "Mes droits en tant que locataire",
                    "Procédure de divorce en Tunisie",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/50 transition-all font-light"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((message, i) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{
                  opacity: 0,
                  animation: `msgIn 0.4s cubic-bezier(0.22,1,0.36,1) ${i < 3 ? i * 60 : 0}ms both`,
                }}
              >
                {/* Assistant avatar */}
                {message.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-border/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs text-primary">⚖</span>
                  </div>
                )}

                <div
                  className={`max-w-[76%] rounded-2xl text-sm font-sans ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-xs'
                      : 'bg-card text-card-foreground border border-border/40 rounded-tl-sm shadow-xs'
                  }`}
                >
                  <div className="px-4 py-3">
                    {message.parts.map((part, index) => renderPart(part, index))}
                  </div>
                </div>

                {/* User avatar */}
                {message.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-muted border border-border/30 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-medium text-muted-foreground">
                    {initials}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {(status === 'submitted' || status === 'streaming') && (
              <div
                className="flex gap-3 justify-start"
                style={{ animation: 'msgIn 0.3s ease both' }}
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-border/30 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs text-primary">⚖</span>
                </div>
                <div className="bg-card border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3 shadow-xs">
                  {status === 'submitted' ? (
                    <div className="flex gap-1 items-center h-4">
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
                          style={{ animation: `dotBounce 1.2s ease-in-out ${delay}ms infinite` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground font-light">En train de rédiger…</span>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Error ── */}
          {chatError && (
            <div className="mx-4 mb-3 bg-destructive/8 border border-destructive/20 rounded-xl p-3">
              <p className="text-destructive text-xs font-sans">Erreur : {chatError.message}</p>
            </div>
          )}

          {/* ── Files preview ── */}
          {files && files.length > 0 && (
            <div className="mx-4 mb-2 flex gap-2 p-2 bg-muted/40 rounded-xl overflow-x-auto border border-border/30">
              {Array.from(files).map((file, index) => (
                <div
                  key={index}
                  className="text-xs text-muted-foreground bg-background border border-border/30 px-2.5 py-1.5 rounded-lg whitespace-nowrap font-light"
                >
                  📎 {file.name} <span className="opacity-50">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Input ── */}
          <div className="px-4 pb-4 pt-2">
            <style>{`
              @keyframes msgIn {
                from { opacity: 0; transform: translateY(10px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              @keyframes dotBounce {
                0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                40%           { transform: translateY(-4px); opacity: 1; }
              }
              @keyframes floatSlow {
                0%, 100% { transform: translateY(0px); }
                50%       { transform: translateY(-6px); }
              }
            `}</style>
            <form onSubmit={handleSubmit}>
              <div className="flex items-end gap-2 bg-card border border-border/50 rounded-2xl px-4 py-3 shadow-xs focus-within:border-accent/40 focus-within:shadow-sm transition-all duration-200">

                {/* Attach */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-muted-foreground hover:text-accent transition-colors mb-0.5 shrink-0"
                  title="Joindre un fichier"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  type="file"
                  onChange={(e) => { if (e.target.files) setFiles(e.target.files); }}
                  multiple ref={fileInputRef} className="hidden"
                />

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() || files?.length) handleSubmit(e);
                    }
                  }}
                  placeholder="Posez votre question juridique…"
                  disabled={status !== 'ready'}
                  rows={1}
                  className="flex-1 bg-transparent focus:outline-none disabled:opacity-40 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 resize-none leading-relaxed"
                />

                {/* Stop / Send */}
                {(status === 'submitted' || status === 'streaming') ? (
                  <button
                    type="button"
                    onClick={() => stop()}
                    className="w-8 h-8 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center justify-center shrink-0 mb-0.5"
                    title="Arrêter"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={status !== 'ready' || (!input.trim() && (!files || files.length === 0))}
                    className="w-8 h-8 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center shrink-0 mb-0.5"
                    title="Envoyer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-center text-[11px] text-muted-foreground/40 mt-2 font-light">
                Entrée pour envoyer · Shift+Entrée pour un saut de ligne
              </p>
            </form>
          </div>

        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
