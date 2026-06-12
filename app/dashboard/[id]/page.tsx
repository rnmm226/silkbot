"use client";

import { useRef, useState, useMemo, useEffect, use } from 'react';
import { AppSidebar } from "@/components/app-sidebar";
import { NavActions } from "@/components/nav-actions";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AlertDialogWithMedia } from "@/components/alert-dialog-with-media";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { generateId } from 'ai';
import type { UIMessage } from 'ai';
import { Send, Pencil, X, ChevronDown, ChevronUp, FileText, Scale, Sparkles } from 'lucide-react';
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
  structured?: StructuredResponse;
}

// ─────────────────────────────────────────────
// Parse structured from UIMessage parts
// ─────────────────────────────────────────────

function parseStructuredFromParts(parts: UIMessage['parts']): StructuredResponse | undefined {
  if (!parts) return undefined;
  for (const part of parts) {
    // Cherche un part de type 'text' qui contient le marqueur RAG
    if (part.type === 'text' && part.text?.startsWith('<!--RAG:')) {
      try {
        const json = part.text.replace('<!--RAG:', '').replace('-->', '').trim();
        return JSON.parse(json) as StructuredResponse;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function convertUIMessages(msgs: UIMessage[]): ChatMessage[] {
  return msgs.map(m => {
    const textPart = m.parts?.find(
      (p): p is { type: 'text'; text: string } => p.type === 'text' && !p.text?.startsWith('<!--RAG:')
    );
    const text = textPart?.text || '';
    const structured = m.role === 'assistant' ? parseStructuredFromParts(m.parts) : undefined;
    return {
      id: m.id,
      role: m.role as 'user' | 'assistant',
      text,
      structured,
    };
  });
}

// ─────────────────────────────────────────────
// ThinkingBlock
// ─────────────────────────────────────────────

function ThinkingBlock({ summary }: { summary: ThinkingSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2.5 rounded-2xl overflow-hidden border"
      style={{
        borderColor: 'color-mix(in oklch, var(--color-primary,#c4956a) 20%, transparent)',
        background: 'color-mix(in oklch, var(--color-primary,#c4956a) 4%, transparent)',
      }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary,#c4956a)', opacity: 0.7 }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
            <span style={{ color: 'var(--color-primary,#c4956a)' }}>{summary.chunks_analyzed}</span> passages analysés ·{' '}
            <span style={{ color: 'var(--color-primary,#c4956a)' }}>{summary.chunks_retained}</span> retenus ·{' '}
            <span style={{ color: 'var(--color-primary,#c4956a)' }}>{summary.documents_retained.length}</span> document{summary.documents_retained.length !== 1 ? 's' : ''} utilisé{summary.documents_retained.length !== 1 ? 's' : ''}
          </span>
        </div>
        {open
          ? <ChevronUp className="w-3 h-3 shrink-0 opacity-40" />
          : <ChevronDown className="w-3 h-3 shrink-0 opacity-40" />
        }
      </button>
      {open && (
        <div className="px-4 pb-3 border-t"
          style={{ borderColor: 'color-mix(in oklch, var(--color-primary,#c4956a) 15%, transparent)' }}>
          <div className="flex flex-col gap-1.5 mt-2.5">
            {summary.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                <span className="mt-1.5 w-1 h-1 rounded-full shrink-0"
                  style={{ background: 'var(--color-primary,#c4956a)', opacity: 0.5 }} />
                {step}
              </div>
            ))}
          </div>
          {summary.documents_retained.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5"
              style={{ borderTop: '1px solid color-mix(in oklch, var(--color-primary,#c4956a) 12%, transparent)' }}>
              {summary.documents_retained.map(doc => (
                <span key={doc} style={{
                  fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
                  background: 'color-mix(in oklch, var(--color-primary,#c4956a) 10%, transparent)',
                  color: 'var(--color-primary,#c4956a)',
                  border: '1px solid color-mix(in oklch, var(--color-primary,#c4956a) 20%, transparent)',
                }}>
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

// ─────────────────────────────────────────────
// SourcesBlock
// ─────────────────────────────────────────────

function SourcesBlock({ sources, onSourceClick }: { sources: UsedSource[]; onSourceClick: (s: UsedSource) => void }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-4 pt-3.5"
      style={{ borderTop: '1px solid color-mix(in oklch, currentColor 10%, transparent)' }}>
      <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.4, marginBottom: '8px', fontWeight: 600 }}>
        Sources
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <button
            key={source.chunk_id}
            onClick={() => onSourceClick(source)}
            title={source.excerpt}
            className="flex items-center gap-1.5 transition-all"
            style={{
              padding: '4px 10px 4px 7px', borderRadius: '20px',
              border: '1px solid color-mix(in oklch, var(--color-primary,#c4956a) 25%, transparent)',
              background: 'color-mix(in oklch, var(--color-primary,#c4956a) 6%, transparent)',
              fontSize: '11px', color: 'var(--color-primary,#c4956a)',
            }}
          >
            <FileText className="w-2.5 h-2.5 shrink-0" />
            <span className="font-medium">{source.filename}</span>
            {source.page && <span style={{ opacity: 0.6, fontSize: '10px' }}>· p.{source.page}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// AssistantBubble
// ─────────────────────────────────────────────

function AssistantBubble({ msg, onSourceClick }: { msg: ChatMessage; onSourceClick: (s: UsedSource) => void }) {
  if (!msg.structured) {
    return (
      <div className="max-w-[78%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
        style={{ background: 'var(--color-card,#1a1815)', border: '1px solid var(--color-border,#2a2520)' }}>
        <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
      </div>
    );
  }
  const { thinking_summary, answer, used_sources } = msg.structured;
  return (
    <div className="flex flex-col max-w-[78%]">
      <ThinkingBlock summary={thinking_summary} />
      <div className="rounded-2xl rounded-tl-sm px-5 py-4"
        style={{ background: 'var(--color-card,#1a1815)', border: '1px solid var(--color-border,#2a2520)' }}>
        <div className="prose prose-sm dark:prose-invert max-w-none" style={{ fontSize: '14px', lineHeight: '1.75' }}>
          <ReactMarkdown>{answer}</ReactMarkdown>
        </div>
        <SourcesBlock sources={used_sources} onSourceClick={onSourceClick} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Suggestions
// ─────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: "📋", label: "Créer une SARL", prompt: "Quelles sont les étapes pour créer une SARL en Tunisie ?" },
  { icon: "🏠", label: "Droits du locataire", prompt: "Quels sont mes droits en tant que locataire en Tunisie ?" },
  { icon: "⚖️", label: "Divorce", prompt: "Quelle est la procédure de divorce en droit tunisien ?" },
  { icon: "💼", label: "Contrat de travail", prompt: "Quelles sont les obligations légales d'un contrat de travail ?" },
];

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isPending, error } = authClient.useSession();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [chatTitle, setChatTitle] = useState('Nouvelle conversation');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [selectedSource, setSelectedSource] = useState<UsedSource | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatId = id ?? useMemo(() => generateId(), []);

  const LOADING_STEPS = ["Recherche dans les documents…", "Analyse des passages…", "Rédaction de la réponse…"];

  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const interval = setInterval(() => setLoadingStep(s => (s + 1) % LOADING_STEPS.length), 2200);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Charger les messages (avec structured) ──
  useEffect(() => {
    if (!id) return;
    setMessages([]); // reset à chaque changement de conversation
    fetch(`/api/chat/${id}/messages`)
      .then(res => res.ok ? res.json() : [])
      .then((msgs: UIMessage[]) => {
        setMessages(convertUIMessages(msgs));
      })
      .catch(() => {});
  }, [id]); // ✅ se re-déclenche à chaque changement d'id

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

    const userMsg: ChatMessage = { id: generateId(), role: 'user', text: input };
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
          message: { id: userMsg.id, role: 'user', parts: [{ type: 'text', text: userMsg.text }] },
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || `HTTP ${res.status}`);

      const structured = resData as StructuredResponse;
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        text: structured.answer,
        structured,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        text: `Erreur : ${(err as Error).message}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (isPending) return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--color-background,#0f0e0c)' }}>
      <div className="flex flex-col items-center gap-3">
        <Scale className="w-6 h-6 animate-pulse" style={{ color: 'var(--color-primary,#c4956a)' }} />
        <span className="text-xs font-light tracking-widest" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>CHARGEMENT</span>
      </div>
    </div>
  );

  if (!data || error) return null;

  const firstName = data?.user?.name?.split(' ')[0] ?? '';
  const initials = data?.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>

        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 px-4"
          style={{ borderBottom: '1px solid var(--color-border,#2a2520)', background: 'color-mix(in oklch, var(--color-background,#0f0e0c) 90%, transparent)', backdropFilter: 'blur(12px)' }}>
          <SidebarTrigger className="shrink-0" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }} />
          <Separator orientation="vertical" className="h-4 opacity-20" />
          <Breadcrumb className="flex-1 min-w-0">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {isEditingTitle ? (
                    <input autoFocus value={titleInput}
                      onChange={e => setTitleInput(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setIsEditingTitle(false); }}
                      className="bg-transparent border-b focus:outline-none text-sm w-56"
                      style={{ borderColor: 'var(--color-primary,#c4956a)', color: 'var(--color-foreground,#e8e0d0)' }}
                    />
                  ) : (
                    <button onClick={() => { setTitleInput(chatTitle); setIsEditingTitle(true); }}
                      className="flex items-center gap-1.5 group transition-colors"
                      style={{ color: 'color-mix(in oklch, var(--color-foreground,#e8e0d0) 70%, transparent)' }}>
                      <span className="font-medium text-sm truncate max-w-[220px]">{chatTitle}</span>
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
                    </button>
                  )}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <span className="hidden sm:block text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>{data?.user?.name}</span>
            <AlertDialogWithMedia />
            <NavActions />
            <Button variant="outline" size="sm" onClick={() => authClient.signOut()}
              className="text-xs h-7 font-normal"
              style={{ borderColor: 'color-mix(in oklch, var(--color-border,#2a2520) 80%, transparent)' }}>
              Déconnexion
            </Button>
          </div>
        </header>

        {/* Chat layout */}
        <div className="flex flex-col h-[calc(100vh-3.5rem)]">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8"
            style={{ background: 'var(--color-background,#0f0e0c)' }}>

            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
                <div className="relative mb-8">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'color-mix(in oklch, var(--color-primary,#c4956a) 10%, transparent)',
                      border: '1px solid color-mix(in oklch, var(--color-primary,#c4956a) 25%, transparent)',
                      animation: 'floatSlow 5s ease-in-out infinite',
                    }}>
                    <Scale className="w-7 h-7" style={{ color: 'var(--color-primary,#c4956a)' }} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--color-primary,#c4956a)' }}>
                    <Sparkles className="w-2.5 h-2.5" style={{ color: '#0f0e0c' }} />
                  </div>
                </div>
                <h2 className="font-serif text-2xl font-semibold mb-2" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                  Bonjour{firstName ? `, ${firstName}` : ''}.
                </h2>
                <p className="text-sm font-light leading-relaxed mb-8" style={{ color: 'var(--color-muted-foreground,#8a7f72)', maxWidth: '300px' }}>
                  Posez votre question. Je recherche dans les textes officiels tunisiens et cite mes sources.
                </p>
                <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.label} onClick={() => setInput(s.prompt)}
                      className="text-left p-3 rounded-xl transition-all"
                      style={{ background: 'var(--color-card,#1a1815)', border: '1px solid var(--color-border,#2a2520)' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--color-primary,#c4956a) 35%, transparent)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border,#2a2520)')}>
                      <div className="text-lg mb-1">{s.icon}</div>
                      <div className="text-xs font-medium" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>{s.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages list */}
            <div className="max-w-3xl mx-auto flex flex-col gap-6">
              {messages.map((message, i) => (
                <div key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  style={{ opacity: 0, animation: `msgIn 0.35s cubic-bezier(0.22,1,0.36,1) ${i < 4 ? i * 50 : 0}ms both` }}>

                  {message.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-1"
                      style={{
                        background: 'color-mix(in oklch, var(--color-primary,#c4956a) 12%, transparent)',
                        border: '1px solid color-mix(in oklch, var(--color-primary,#c4956a) 25%, transparent)',
                      }}>
                      <Scale className="w-3.5 h-3.5" style={{ color: 'var(--color-primary,#c4956a)' }} />
                    </div>
                  )}

                  {message.role === 'user' ? (
                    <div className="max-w-[72%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
                      style={{ background: 'var(--color-primary,#c4956a)', color: '#0f0e0c' }}>
                      <p>{message.text}</p>
                    </div>
                  ) : (
                    <AssistantBubble msg={message} onSourceClick={setSelectedSource} />
                  )}

                  {message.role === 'user' && (
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-1 text-[10px] font-semibold"
                      style={{ background: 'var(--color-card,#1a1815)', border: '1px solid var(--color-border,#2a2520)', color: 'var(--color-muted-foreground,#8a7f72)' }}>
                      {initials}
                    </div>
                  )}
                </div>
              ))}

              {/* Loading */}
              {loading && (
                <div className="flex gap-3 justify-start" style={{ opacity: 0, animation: 'msgIn 0.25s ease both' }}>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-1"
                    style={{
                      background: 'color-mix(in oklch, var(--color-primary,#c4956a) 12%, transparent)',
                      border: '1px solid color-mix(in oklch, var(--color-primary,#c4956a) 25%, transparent)',
                    }}>
                    <Scale className="w-3.5 h-3.5" style={{ color: 'var(--color-primary,#c4956a)', animation: 'pulse 2s ease-in-out infinite' }} />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-3"
                    style={{ background: 'var(--color-card,#1a1815)', border: '1px solid var(--color-border,#2a2520)' }}>
                    <div className="flex gap-1">
                      {[0, 180, 360].map(delay => (
                        <span key={delay} className="w-1.5 h-1.5 rounded-full"
                          style={{ background: 'var(--color-primary,#c4956a)', animation: `dotBounce 1.4s ease-in-out ${delay}ms infinite` }} />
                      ))}
                    </div>
                    <span className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                      {LOADING_STEPS[loadingStep]}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="px-4 sm:px-8 pb-5 pt-3"
            style={{ background: 'var(--color-background,#0f0e0c)', borderTop: '1px solid color-mix(in oklch, var(--color-border,#2a2520) 60%, transparent)' }}>
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-2.5 rounded-2xl px-4 py-3 transition-all duration-200"
                style={{ background: 'var(--color-card,#1a1815)', border: '1px solid var(--color-border,#2a2520)' }}
                onFocusCapture={e => (e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--color-primary,#c4956a) 40%, transparent)')}
                onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--color-border,#2a2520)')}>
                <textarea ref={textareaRef} value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Posez votre question juridique…"
                  disabled={loading} rows={1}
                  className="flex-1 bg-transparent focus:outline-none text-sm resize-none leading-relaxed disabled:opacity-40"
                  style={{ color: 'var(--color-foreground,#e8e0d0)', fontFamily: 'DM Sans, sans-serif' }}
                />
                <button onClick={sendMessage} disabled={loading || !input.trim()}
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mb-0.5 transition-all active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed"
                  style={{ background: 'var(--color-primary,#c4956a)' }}>
                  <Send className="w-3.5 h-3.5" style={{ color: '#0f0e0c' }} />
                </button>
              </div>
              <p className="text-center mt-2" style={{ fontSize: '10px', color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 40%, transparent)' }}>
                Entrée pour envoyer · Shift+Entrée pour un saut de ligne
              </p>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* PDF Modal */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', animation: 'fadeIn 0.2s ease' }}
          onClick={() => setSelectedSource(null)}>
          <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--color-card,#1a1815)', border: '1px solid var(--color-border,#2a2520)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--color-border,#2a2520)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'color-mix(in oklch, var(--color-primary,#c4956a) 12%, transparent)' }}>
                  <FileText className="w-4 h-4" style={{ color: 'var(--color-primary,#c4956a)' }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                      {selectedSource.filename}
                    </span>
                    {selectedSource.page && (
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: 'color-mix(in oklch, var(--color-primary,#c4956a) 12%, transparent)', color: 'var(--color-primary,#c4956a)' }}>
                        Page {selectedSource.page}
                      </span>
                    )}
                  </div>
                  {selectedSource.excerpt && (
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                      « {selectedSource.excerpt} »
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedSource(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ml-3 transition-colors hover:bg-white/5">
                <X className="w-4 h-4" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <PDFViewer filename={selectedSource.filename} initialPage={selectedSource.page ?? 1} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes msgIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes dotBounce { 0%,80%,100% { transform:translateY(0); opacity:.35; } 40% { transform:translateY(-5px); opacity:1; } }
        @keyframes floatSlow { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-7px); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </SidebarProvider>
  );
}