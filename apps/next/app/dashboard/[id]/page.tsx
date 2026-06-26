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
import { Send, Pencil, X, ChevronDown, ChevronUp, FileText, Scale, Sparkles, Copy, Check, Loader2, Paperclip } from 'lucide-react';
import { PDFViewer } from "@/components/PDFViewer";
import ReactMarkdown from 'react-markdown';
import Image from "next/image";

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

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  uploading?: boolean;
  error?: string;
}

// ─────────────────────────────────────────────
// Parse structured from UIMessage parts
// ─────────────────────────────────────────────

function parseStructuredFromParts(parts: UIMessage['parts']): StructuredResponse | undefined {
  if (!parts) return undefined;
  for (const part of parts) {
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
// MessageActions - Copier/Modifier un message
// ─────────────────────────────────────────────

function MessageActions({ 
  text, 
  onEdit, 
  isUser 
}: { 
  text: string; 
  onEdit?: () => void;
  isUser?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={copyToClipboard}
        className="p-1 rounded-md hover:bg-accent transition-colors"
        title="Copier le message"
        aria-label="Copier le message"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      {isUser && onEdit && (
        <button
          onClick={onEdit}
          className="p-1 rounded-md hover:bg-accent transition-colors"
          title="Modifier le message"
          aria-label="Modifier le message"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ThinkingBlock
// ─────────────────────────────────────────────

function ThinkingBlock({ summary }: { summary: ThinkingSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="mb-2.5 rounded-lg overflow-hidden border"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--muted)',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors"
        style={{ background: 'transparent' }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Sparkles
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: 'var(--primary)', opacity: 0.7 }}
          />
          <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
            <span style={{ color: 'var(--foreground)' }}>{summary.chunks_analyzed}</span> passages analysés ·{' '}
            <span style={{ color: 'var(--foreground)' }}>{summary.chunks_retained}</span> retenus ·{' '}
            <span style={{ color: 'var(--foreground)' }}>{summary.documents_retained.length}</span> document{summary.documents_retained.length !== 1 ? 's' : ''} utilisé{summary.documents_retained.length !== 1 ? 's' : ''}
          </span>
        </div>
        {open
          ? <ChevronUp className="w-3 h-3 shrink-0 opacity-40" />
          : <ChevronDown className="w-3 h-3 shrink-0 opacity-40" />
        }
      </button>
      {open && (
        <div
          className="px-4 pb-3 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex flex-col gap-1.5 mt-2.5">
            {summary.steps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 text-xs"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <span
                  className="mt-1.5 w-1 h-1 rounded-full shrink-0"
                  style={{ background: 'var(--primary)', opacity: 0.5 }}
                />
                {step}
              </div>
            ))}
          </div>
          {summary.documents_retained.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5 mt-3 pt-2.5"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              {summary.documents_retained.map(doc => (
                <span
                  key={doc}
                  style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--secondary)',
                    color: 'var(--secondary-foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
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
    <div
      className="mt-4 pt-3.5"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <p style={{
        fontSize: '9px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        opacity: 0.45,
        marginBottom: '8px',
        fontWeight: 600,
        color: 'var(--foreground)',
      }}>
        Sources
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <button
            key={source.chunk_id}
            onClick={() => onSourceClick(source)}
            title={source.excerpt}
            aria-label={`Ouvrir la source ${source.filename}${source.page ? `, page ${source.page}` : ''}`}
            className="flex items-center gap-1.5 transition-all"
            style={{
              padding: '4px 10px 4px 7px',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              background: 'var(--secondary)',
              fontSize: '11px',
              color: 'var(--foreground)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--secondary)';
            }}
          >
            <FileText className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--primary)' }} />
            <span className="font-medium">{source.filename}</span>
            {source.page && (
              <span style={{ opacity: 0.5, fontSize: '10px' }}>· p.{source.page}</span>
            )}
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
      <div
        className="max-w-[78%] rounded-lg rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--card-foreground)',
        }}
      >
        <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
      </div>
    );
  }
  const { thinking_summary, answer, used_sources } = msg.structured;
  return (
    <div className="flex flex-col max-w-[78%]">
      <ThinkingBlock summary={thinking_summary} />
      <div
        className="rounded-lg rounded-tl-sm px-5 py-4"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--card-foreground)',
        }}
      >
        <div
          className="prose prose-sm max-w-none"
          style={{ fontSize: '14px', lineHeight: '1.75', color: 'var(--foreground)' }}
        >
          <ReactMarkdown>{answer}</ReactMarkdown>
        </div>
        <SourcesBlock sources={used_sources} onSourceClick={onSourceClick} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FileUploadButton - Composant pour l'upload
// ─────────────────────────────────────────────

function FileUploadButton({ 
  onFileSelect, 
  disabled,
  acceptedTypes = ['.pdf', '.doc', '.docx', '.txt'],
  maxSize = 10
}: { 
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  acceptedTypes?: string[];
  maxSize?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validation taille
    if (file.size > maxSize * 1024 * 1024) {
      setError(`Le fichier dépasse ${maxSize} Mo`);
      return;
    }

    // Validation type
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(ext)) {
      setError(`Type non supporté. Acceptés: ${acceptedTypes.join(', ')}`);
      return;
    }

    onFileSelect(file);
    e.target.value = '';
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        accept={acceptedTypes.join(',')}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-accent disabled:opacity-40"
        title="Joindre un fichier"
        aria-label="Joindre un fichier"
      >
        <Paperclip className="w-4 h-4 text-muted-foreground" />
      </button>
      {error && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// AttachedFile - Affichage d'un fichier joint
// ─────────────────────────────────────────────

function AttachedFile({ 
  file, 
  onRemove 
}: { 
  file: UploadedFile; 
  onRemove: (id: string) => void;
}) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg border border-border/50 group max-w-[200px]">
      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{file.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {formatSize(file.size)}
          {file.uploading && ' · Upload...'}
          {file.error && <span className="text-destructive"> · Erreur</span>}
        </div>
      </div>
      {!file.uploading && (
        <button
          onClick={() => onRemove(file.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/10 rounded"
          aria-label={`Retirer le fichier ${file.name}`}
        >
          <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
        </button>
      )}
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
  const [logoError, setLogoError] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // FIX: l'ancien code était `id ?? useMemo(() => generateId(), [])`. Le `??`
  // court-circuite l'appel du hook selon la présence de `id`, ce qui viole les
  // règles des Hooks React (un hook ne doit jamais être appelé conditionnellement).
  // On appelle systématiquement useMemo, et on ne s'en sert que si `id` est absent.
  const fallbackId = useMemo(() => generateId(), []);
  const chatId = id ?? fallbackId;

  const LOADING_STEPS = ["Recherche dans les documents…", "Analyse des passages…", "Rédaction de la réponse…"];

  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const interval = setInterval(() => setLoadingStep(s => (s + 1) % LOADING_STEPS.length), 2200);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!id) return;
    setMessages([]);

    // FIX: protection contre une condition de course — si l'utilisateur change
    // rapidement de conversation dans la sidebar, une requête lente pour l'ancien
    // chat ne doit pas écraser les messages de la nouvelle conversation une fois résolue.
    let isCurrent = true;
    fetch(`/api/chat/${id}/messages`)
      .then(res => res.ok ? res.json() : [])
      .then((msgs: UIMessage[]) => {
        if (isCurrent) setMessages(convertUIMessages(msgs));
      })
      .catch(() => {});

    return () => { isCurrent = false; };
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
  }, [messages, loading]);

  useEffect(() => {
    if (!isPending && (!data || error)) router.replace("/login");
  }, [data, error, isPending, router]);

  useEffect(() => {
    if (editingMessageId && editTextareaRef.current) {
      editTextareaRef.current.focus();
    }
  }, [editingMessageId]);

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

  const startEditMessage = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditInput(message.text);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditInput('');
  };

  const saveEditMessage = async (messageId: string) => {
    if (!editInput.trim()) {
      cancelEditMessage();
      return;
    }

    const messageIndex = messages.findIndex(m => m.id === messageId);

    // FIX: l'ancien code appelait deux fois setMessages (une fois via .map() pour
    // mettre à jour le texte, puis une seconde fois via .slice() pour tronquer la
    // conversation) — le premier appel était systématiquement écrasé par le second.
    // On ne garde qu'une seule mise à jour d'état, plus claire.
    if (messageIndex === -1 || messages[messageIndex].role !== 'user') {
      cancelEditMessage();
      return;
    }

    const updatedMessages = messages.slice(0, messageIndex + 1);
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      text: editInput.trim(),
    };
    setMessages(updatedMessages);

    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: chatId,
          message: { 
            id: updatedMessages[messageIndex].id, 
            role: 'user', 
            parts: [{ type: 'text', text: editInput.trim() }] 
          },
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
      window.dispatchEvent(new Event('chat-updated'));
    } catch (err) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        text: `Erreur : ${(err as Error).message}`,
      }]);
    } finally {
      setLoading(false);
      cancelEditMessage();
    }
  };

  // ─────────────────────────────────────────────
  // Gestion des fichiers
  // ─────────────────────────────────────────────

  const handleFileSelect = (file: File) => {
    const newFile: UploadedFile = {
      id: generateId(),
      name: file.name,
      size: file.size,
      type: file.type,
      uploading: true,
    };

    setUploadedFiles(prev => [...prev, newFile]);

    // Upload réel
    uploadFile(file, newFile.id);
  };

  const uploadFile = async (file: File, fileId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chatId', chatId);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'upload');
      }

      const data = await response.json();

      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, uploading: false, url: data.url }
          : f
      ));

      // Ajouter un message système indiquant que le fichier a été uploadé
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        text: `📎 **Fichier joint** : ${file.name}\n\nLe fichier a été téléchargé avec succès. Vous pouvez maintenant poser des questions à son sujet.`,
      }]);

      window.dispatchEvent(new Event('chat-updated'));

    } catch (error) {
      console.error('Upload error:', error);
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, uploading: false, error: error instanceof Error ? error.message : 'Erreur d\'upload' }
          : f
      ));
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // ─────────────────────────────────────────────
  // Envoi de message
  // ─────────────────────────────────────────────

  // FIX: un fichier encore en cours d'upload n'est pas disponible côté serveur —
  // on bloque l'envoi tant qu'au moins un fichier joint est encore "uploading".
  const hasFilesUploading = uploadedFiles.some(f => f.uploading);

  const sendMessage = async () => {
    if (!input.trim() || loading || hasFilesUploading) return;

    // Construire le message avec les fichiers joints
    let messageText = input;
    if (uploadedFiles.length > 0) {
      const fileNames = uploadedFiles.map(f => f.name).join(', ');
      messageText = `${input}\n\n[Fichiers joints: ${fileNames}]`;
    }

    const userMsg: ChatMessage = { id: generateId(), role: 'user', text: messageText };
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
          message: { id: userMsg.id, role: 'user', parts: [{ type: 'text', text: messageText }] },
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

      // Vider les fichiers après l'envoi
      setUploadedFiles([]);
      window.dispatchEvent(new Event('chat-updated'));

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

  const handleDeleteChat = async () => {
    if (!confirm('Supprimer cette conversation ?')) return;
    try {
      await fetch(`/api/chat/${id}`, { method: 'DELETE' });
      router.push('/dashboard');
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
    }
  };

  const handleShareChat = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (err) {
      console.error('Erreur lors du partage:', err);
    }
  };

  // ─────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────

  if (isPending) return (
    <div
      className="flex items-center justify-center h-screen"
      style={{ background: 'var(--background)' }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="flex size-12 items-center justify-center rounded-xl overflow-hidden"
          style={{ background: 'var(--primary)' }}
        >
          {logoError ? (
            <Scale className="w-6 h-6 animate-pulse" style={{ color: 'var(--primary-foreground)' }} />
          ) : (
            <Image
              src="/silkbot-logo-white.png"
              alt="SilkBot Logo"
              width={48}
              height={48}
              className="object-contain"
              onError={() => setLogoError(true)}
            />
          )}
        </div>
        <span
          className="text-xs font-light tracking-widest"
          style={{ color: 'var(--muted-foreground)' }}
        >
          CHARGEMENT
        </span>
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
        <header
  className="flex h-14 shrink-0 items-center gap-2 px-4"
  style={{
    borderBottom: '1px solid var(--border)',
    background: 'var(--background)',
  }}
>
  <SidebarTrigger
    className="shrink-0"
    style={{ color: 'var(--muted-foreground)' }}
  />
  <Separator orientation="vertical" className="h-4 opacity-20" />

  <Breadcrumb className="flex-1 min-w-0">
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbPage>
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
              className="bg-transparent border-b focus:outline-none text-sm w-56"
              style={{
                borderColor: 'var(--primary)',
                color: 'var(--foreground)',
              }}
              aria-label="Titre de la conversation"
            />
          ) : (
            <button
              onClick={() => { setTitleInput(chatTitle); setIsEditingTitle(true); }}
              className="flex items-center gap-1.5 group transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <span className="font-medium text-sm truncate max-w-[220px]">{chatTitle}</span>
              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
            </button>
          )}
        </BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>

  <div className="flex items-center gap-2 ml-auto shrink-0">
    <span
      className="hidden sm:block text-xs font-light"
      style={{ color: 'var(--muted-foreground)' }}
    >
      {data?.user?.name}
    </span>
    
    <AlertDialogWithMedia />
    <NavActions
      onRename={() => {
        setTitleInput(chatTitle);
        setIsEditingTitle(true);
      }}
      onShare={handleShareChat}
      onExportPdf={() => window.print()}
      onDelete={handleDeleteChat}
    />
  </div>
</header>

        {/* Chat layout */}
        <div className="flex flex-col h-[calc(100vh-3.5rem)]">

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 sm:px-8 py-8"
            style={{ background: 'var(--background)' }}
          >

            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
                <div className="relative mb-8">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
                    style={{
                      background: 'var(--secondary)',
                      border: '1px solid var(--border)',
                      animation: 'floatSlow 5s ease-in-out infinite',
                    }}
                  >
                    {logoError ? (
                      <Scale className="w-7 h-7" style={{ color: 'var(--primary)' }} />
                    ) : (
                      <Image
                        src="/silkbot-logo.png"
                        alt="SilkBot Logo"
                        width={56}
                        height={56}
                        className="object-contain"
                        onError={() => setLogoError(true)}
                      />
                    )}
                  </div>
                  <div
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--primary)' }}
                  >
                    <Sparkles className="w-2.5 h-2.5" style={{ color: 'var(--primary-foreground)' }} />
                  </div>
                </div>

                <h2
                  className="font-serif text-2xl font-semibold mb-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  Bonjour{firstName ? `, ${firstName}` : ''}.
                </h2>
                <p
                  className="text-sm font-light leading-relaxed mb-8"
                  style={{ color: 'var(--muted-foreground)', maxWidth: '300px' }}
                >
                  Posez votre question. Je recherche dans les textes officiels tunisiens et cite mes sources.
                </p>

                <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setInput(s.prompt)}
                      className="text-left p-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5"
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: 'var(--card-foreground)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)';
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--card)';
                      }}
                    >
                      <div className="text-lg mb-1">{s.icon}</div>
                      <div
                        className="text-xs font-medium"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {s.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages list */}
            <div className="max-w-3xl mx-auto flex flex-col gap-6">
              {messages.map((message, i) => {
                const isEditing = editingMessageId === message.id;
                const isUser = message.role === 'user';

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 group ${isUser ? 'justify-end' : 'justify-start'}`}
                    style={{
                      opacity: 0,
                      animation: `msgIn 0.35s cubic-bezier(0.22,1,0.36,1) ${i < 4 ? i * 50 : 0}ms both`,
                    }}
                  >
                    {/* Assistant avatar */}
                    {!isUser && (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1 overflow-hidden"
                        style={{
                          background: 'var(--secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {logoError ? (
                          <Scale className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
                        ) : (
                          <Image
                            src="/silkbot-logo-white.png"
                            alt="SilkBot"
                            width={24}
                            height={24}
                            className="object-contain"
                            onError={() => setLogoError(true)}
                          />
                        )}
                      </div>
                    )}

                    {/* Message content */}
                    <div className="flex flex-col">
                      {isEditing ? (
                        <div
                          className="flex flex-col gap-2"
                          style={{
                            maxWidth: '78%',
                          }}
                        >
                          <textarea
                            ref={editTextareaRef}
                            value={editInput}
                            onChange={e => setEditInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                saveEditMessage(message.id);
                              }
                              if (e.key === 'Escape') {
                                cancelEditMessage();
                              }
                            }}
                            className="rounded-lg px-4 py-3 text-sm resize-none focus:outline-none"
                            style={{
                              background: 'var(--card)',
                              border: '1px solid var(--primary)',
                              color: 'var(--foreground)',
                              minWidth: '200px',
                              minHeight: '60px',
                            }}
                            rows={3}
                            aria-label="Modifier le message"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEditMessage(message.id)}
                              className="px-3 py-1 rounded-md text-xs font-medium"
                              style={{
                                background: 'var(--primary)',
                                color: 'var(--primary-foreground)',
                              }}
                            >
                              Enregistrer
                            </button>
                            <button
                              onClick={cancelEditMessage}
                              className="px-3 py-1 rounded-md text-xs font-medium"
                              style={{
                                background: 'var(--secondary)',
                                color: 'var(--secondary-foreground)',
                              }}
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : isUser ? (
                        <div
                          className="max-w-[72%] rounded-lg rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
                          style={{
                            background: 'var(--primary)',
                            color: 'var(--primary-foreground)',
                          }}
                        >
                          <p>{message.text}</p>
                        </div>
                      ) : (
                        <AssistantBubble msg={message} onSourceClick={setSelectedSource} />
                      )}

                      {!isEditing && (
                        <MessageActions
                          text={message.text}
                          isUser={isUser}
                          onEdit={isUser ? () => startEditMessage(message) : undefined}
                        />
                      )}
                    </div>

                    {/* User avatar */}
                    {isUser && !isEditing && (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1 text-[10px] font-semibold"
                        style={{
                          background: 'var(--secondary)',
                          border: '1px solid var(--border)',
                          color: 'var(--muted-foreground)',
                        }}
                      >
                        {initials}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Loading indicator */}
              {loading && (
                <div
                  className="flex gap-3 justify-start"
                  style={{ opacity: 0, animation: 'msgIn 0.25s ease both' }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1 overflow-hidden"
                    style={{
                      background: 'var(--secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {logoError ? (
                      <Scale
                        className="w-3.5 h-3.5"
                        style={{ color: 'var(--primary)', animation: 'pulse 2s ease-in-out infinite' }}
                      />
                    ) : (
                      <Image
                        src="/silkbot-logo-white.png"
                        alt="SilkBot"
                        width={24}
                        height={24}
                        className="object-contain animate-pulse"
                        onError={() => setLogoError(true)}
                      />
                    )}
                  </div>
                  <div
                    className="rounded-lg rounded-tl-sm px-4 py-3.5 flex items-center gap-3"
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
                    <span
                      className="text-xs font-light"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {LOADING_STEPS[loadingStep]}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div
            className="px-4 sm:px-8 pb-5 pt-3"
            style={{
              background: 'var(--background)',
              borderTop: '1px solid var(--border)',
            }}
          >
            <div className="max-w-3xl mx-auto">
              {/* Fichiers attachés */}
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {uploadedFiles.map((file) => (
                    <AttachedFile
                      key={file.id}
                      file={file}
                      onRemove={handleRemoveFile}
                    />
                  ))}
                </div>
              )}

              {/* Zone de saisie */}
              <div
                className="flex items-end gap-2.5 rounded-lg px-4 py-3 transition-all duration-200"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                }}
                onFocusCapture={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--ring)';
                }}
                onBlurCapture={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Posez votre question juridique…"
                  disabled={loading}
                  rows={1}
                  className="flex-1 bg-transparent focus:outline-none text-sm resize-none leading-relaxed disabled:opacity-40"
                  style={{
                    color: 'var(--foreground)',
                    fontFamily: 'var(--font-sans)',
                  }}
                  aria-label="Question juridique"
                />

                {/* Bouton d'upload */}
                <FileUploadButton
                  onFileSelect={handleFileSelect}
                  disabled={loading}
                  acceptedTypes={['.pdf', '.doc', '.docx', '.txt']}
                  maxSize={10}
                />

                {/* Bouton d'envoi */}
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim() || hasFilesUploading}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mb-0.5 transition-all active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed"
                  style={{ background: 'var(--primary)' }}
                  aria-label="Envoyer le message"
                  title={hasFilesUploading ? "Patientez, le fichier est en cours d'envoi…" : "Envoyer"}
                >
                  <Send className="w-3.5 h-3.5" style={{ color: 'var(--primary-foreground)' }} />
                </button>
              </div>

              <p
                className="text-center mt-2"
                style={{
                  fontSize: '10px',
                  color: 'var(--muted-foreground)',
                  opacity: 0.5,
                }}
              >
                Entrée pour envoyer · Shift+Entrée pour un saut de ligne · 📎 pour joindre un fichier
              </p>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* PDF Modal */}
      {selectedSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setSelectedSource(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl overflow-hidden shadow-2xl"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-start justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--secondary)' }}
                >
                  <FileText className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="font-medium text-sm truncate"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {selectedSource.filename}
                    </span>
                    {selectedSource.page && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: 'var(--secondary)',
                          color: 'var(--foreground)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        Page {selectedSource.page}
                      </span>
                    )}
                  </div>
                  {selectedSource.excerpt && (
                    <p
                      className="text-xs mt-0.5 line-clamp-1"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      « {selectedSource.excerpt} »
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedSource(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ml-3 transition-colors"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label="Fermer l'aperçu du document"
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <X className="w-4 h-4" />
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