"use client";

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
import { generateId } from 'ai';
import type { UIMessage } from 'ai';
import { Send, Pencil, X, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { PDFViewer } from "@/components/PDFViewer";
import ReactMarkdown from 'react-markdown';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface UsedSource {
  chunk_id: string;
  filename: string;
  page: number | null;
  excerpt: string;
}

interface ThinkingSummary {
  chunks_analyzed: number;
  chunks_retained: number;
  documents_consulted: string[];
  documents_retained: string[];
  steps: string[];
}

interface StructuredResponse {
  thinking_summary: ThinkingSummary;
  answer: string;
  used_sources: UsedSource[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  structured?: StructuredResponse; // présent seulement pour les messages assistant
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function ThinkingBlock({ summary }: { summary: ThinkingSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/40 overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <span className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="text-primary/70">🔍</span>
          <span>
            {summary.chunks_analyzed} passages analysés ·{' '}
            {summary.chunks_retained} retenus ·{' '}
            {summary.documents_retained.length} document(s) utilisé(s)
          </span>
        </span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-border/30 bg-background/50">
          <div className="flex flex-col gap-1.5">
            {summary.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                {step}
              </div>
            ))}
          </div>
          {summary.documents_retained.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-border/20 flex flex-wrap gap-1.5">
              {summary.documents_retained.map(doc => (
                <span key={doc} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary/70 border border-primary/15">
                  {doc}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SourcesBlock({ sources, onSourceClick }: { sources: UsedSource[]; onSourceClick: (s: UsedSource) => void }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-medium">
        Sources utilisées
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <button
            key={source.chunk_id}
            onClick={() => onSourceClick(source)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/50 bg-background hover:bg-primary/5 hover:border-primary/30 transition-all text-xs group"
            title={source.excerpt}
          >
            <FileText className="w-3 h-3 text-primary/60 shrink-0" />
            <span className="font-medium text-foreground/80">{source.filename}</span>
            {source.page && (
              <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">
                p.{source.page}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function AssistantBubble({ msg, onSourceClick }: { msg: ChatMessage; onSourceClick: (s: UsedSource) => void }) {
  if (!msg.structured) {
    // Fallback : réponse texte brute
    return (
      <div className="bg-card text-card-foreground border border-border/40 rounded-2xl rounded-tl-sm shadow-xs px-4 py-3 text-sm">
        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
      </div>
    );
  }

  const { thinking_summary, answer, used_sources } = msg.structured;

  return (
    <div className="flex flex-col gap-0 max-w-[76%]">
      {/* Thinking block */}
      <ThinkingBlock summary={thinking_summary} />

      {/* Answer card */}
      <div className="bg-card text-card-foreground border border-border/40 rounded-2xl rounded-tl-sm shadow-xs px-4 py-3">
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown>{answer}</ReactMarkdown>
        </div>
        {/* Sources */}
        <SourcesBlock sources={used_sources} onSourceClick={onSourceClick} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isPending, error } = authClient.useSession();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatTitle, setChatTitle] = useState('Nouvelle conversation');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [selectedSource, setSelectedSource] = useState<UsedSource | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatId = id ?? useMemo(() => generateId(), []);

  // Charger les messages existants
  useEffect(() => {
    if (!id) return;
    fetch(`/api/chat/${id}/messages`)
      .then(res => res.ok ? res.json() : [])
      .then((msgs: UIMessage[]) => {
        const converted: ChatMessage[] = msgs.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          text: m.parts?.find((p): p is { type: 'text'; text: string } => p.type === 'text')?.text || '',
        }));
        setMessages(converted);
      })
      .catch(() => {});
  }, [id]);

  // Charger le titre
  useEffect(() => {
    if (!id) return;
    fetch(`/api/chat/${id}/title`)
      .then(res => res.ok ? res.json() : null)
      .then(d => { if (d?.title) setChatTitle(d.title); })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!isPending && (!data || error)) router.replace("/login");
  }, [data, error, isPending, router]);

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

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: input,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: chatId,
          message: {
            id: userMsg.id,
            role: 'user',
            parts: [{ type: 'text', text: userMsg.text }],
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      // Réponse structurée
      const structured = data as StructuredResponse;
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        text: structured.answer,
        structured,
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (err) {
      const errMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        text: `Erreur : ${(err as Error).message}`,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

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

  const initials = data?.user?.name
    ?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>

        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background/80 backdrop-blur-sm px-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0" />
          <Separator orientation="vertical" className="h-4 opacity-30" />
          <Breadcrumb className="flex-1 min-w-0">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1">
                  {isEditingTitle ? (
                    <input
                      autoFocus value={titleInput}
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
            <span className="hidden sm:block text-xs text-muted-foreground font-light">{data?.user?.name}</span>
            <AlertDialogWithMedia />
            <NavActions />
            <Button variant="outline" size="sm" onClick={() => authClient.signOut()}
              className="text-xs h-7 border-border/50 hover:border-border font-normal">
              Déconnexion
            </Button>
          </div>
        </header>

        {/* Chat layout */}
        <div className="flex flex-col h-[calc(100vh-3.5rem)]">

          {/* Sub-header */}
          <div className="border-b border-border/30 px-6 py-3 flex items-center gap-3 bg-background">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm text-primary">⚖</span>
            </div>
            <div>
              <h2 className="font-serif text-base font-semibold text-foreground leading-tight">Assistant juridique</h2>
              <p className="text-[11px] text-muted-foreground font-light">
                Réponses sourcées · Droit tunisien
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[11px] text-muted-foreground font-light">En ligne</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">

            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/8 border border-border/50 flex items-center justify-center mb-4"
                  style={{ animation: 'floatSlow 6s ease-in-out infinite' }}>
                  <span className="text-xl">⚖</span>
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-1">
                  Bonjour{data?.user?.name ? `, ${data.user.name.split(' ')[0]}` : ''} 👋
                </h3>
                <p className="text-sm text-muted-foreground font-light max-w-xs leading-relaxed">
                  Posez votre question juridique. Je vous réponds avec des sources officielles tunisiennes.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-sm">
                  {["Comment créer une SARL ?", "Mes droits en tant que locataire", "Procédure de divorce en Tunisie"].map(s => (
                    <button key={s} onClick={() => setInput(s)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/50 transition-all font-light">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, i) => (
              <div key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ opacity: 0, animation: `msgIn 0.4s cubic-bezier(0.22,1,0.36,1) ${i < 3 ? i * 60 : 0}ms both` }}
              >
                {message.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-border/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs text-primary">⚖</span>
                  </div>
                )}

                {message.role === 'user' ? (
                  <div className="max-w-[76%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm shadow-xs px-4 py-3 text-sm">
                    <p className="leading-relaxed">{message.text}</p>
                  </div>
                ) : (
                  <AssistantBubble msg={message} onSourceClick={setSelectedSource} />
                )}

                {message.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-muted border border-border/30 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-medium text-muted-foreground">
                    {initials}
                  </div>
                )}
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="flex gap-3 justify-start" style={{ animation: 'msgIn 0.3s ease both' }}>
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-border/30 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs text-primary">⚖</span>
                </div>
                <div className="bg-card border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3 shadow-xs flex flex-col gap-2 min-w-[200px]">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 150, 300].map(delay => (
                      <span key={delay} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
                        style={{ animation: `dotBounce 1.2s ease-in-out ${delay}ms infinite` }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-light">Analyse des documents…</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2">
            <style>{`
              @keyframes msgIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
              @keyframes dotBounce { 0%,80%,100% { transform:translateY(0); opacity:.4; } 40% { transform:translateY(-4px); opacity:1; } }
              @keyframes floatSlow { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
            `}</style>
            <div className="flex items-end gap-2 bg-card border border-border/50 rounded-2xl px-4 py-3 shadow-xs focus-within:border-accent/40 transition-all duration-200">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Posez votre question juridique…"
                disabled={loading}
                rows={1}
                className="flex-1 bg-transparent focus:outline-none disabled:opacity-40 text-sm font-sans text-foreground placeholder:text-muted-foreground/50 resize-none leading-relaxed"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center shrink-0 mb-0.5"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-center text-[11px] text-muted-foreground/40 mt-2 font-light">
              Entrée pour envoyer · Shift+Entrée pour un saut de ligne
            </p>
          </div>
        </div>
      </SidebarInset>

      {/* Modal PDF */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between p-4 border-b border-border/40 shrink-0">
              <div>
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  {selectedSource.filename}
                  {selectedSource.page && (
                    <span className="text-muted-foreground font-normal">— Page {selectedSource.page}</span>
                  )}
                </h3>
                {selectedSource.excerpt && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-lg">
                    « {selectedSource.excerpt} »
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedSource(null)}
                className="p-1 rounded-lg hover:bg-muted transition-colors ml-4 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <PDFViewer filename={selectedSource.filename} initialPage={selectedSource.page ?? 1} />
            </div>
          </div>
        </div>
      )}

    </SidebarProvider>
  );
}