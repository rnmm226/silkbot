'use client';

import { useState } from 'react';

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

interface GeminiResponse {
  thinking_summary: ThinkingSummary;
  answer: string;
  used_sources: UsedSource[];
}

export default function TestChatPage() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState<GeminiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [chatId] = useState(() => crypto.randomUUID());

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    setLoading(true);
    setError('');
    setResponse(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: chatId,
          message: {
            id: crypto.randomUUID(),
            role: 'user',
            parts: [{ type: 'text', text: message }],
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setResponse(data as GeminiResponse);
      setMessage('');
      setThinkingOpen(false);

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '2rem',
      maxWidth: 800,
      margin: '0 auto',
      fontFamily: 'DM Sans, sans-serif',
      background: '#0f0e0c',
      minHeight: '100vh',
      color: '#e8e0d0',
    }}>
      <h1 style={{ fontFamily: 'Playfair Display, serif', marginBottom: '0.25rem' }}>
        Test — Counsel RAG
      </h1>
      <p style={{ color: '#6b6058', fontSize: '0.85rem', marginBottom: '2rem' }}>
        Chat ID : {chatId.slice(0, 8)}...
      </p>

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Posez votre question juridique..."
          rows={3}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          style={{
            flex: 1, padding: '0.75rem 1rem', borderRadius: '10px',
            border: '1px solid #2a2520', background: '#1a1815',
            color: '#e8e0d0', fontSize: '0.95rem', resize: 'vertical', outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !message.trim()}
          style={{
            padding: '0 1.5rem', borderRadius: '10px',
            background: loading ? '#2a2520' : '#c4956a',
            color: loading ? '#6b6058' : '#0f0e0c',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: '0.9rem', alignSelf: 'flex-end',
            height: '44px', minWidth: '100px',
          }}
        >
          {loading ? '⏳ ...' : 'Envoyer →'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '8px',
          background: '#3a1a1a', border: '1px solid #6a2d2d',
          color: '#cf6b6b', fontSize: '0.85rem', marginBottom: '1rem',
        }}>
          ❌ {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {['70%', '90%', '55%'].map((w, i) => (
            <div key={i} style={{
              height: '14px', borderRadius: '6px',
              background: 'linear-gradient(90deg, #1a1815 25%, #2a2520 50%, #1a1815 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              width: w,
            }} />
          ))}
        </div>
      )}

      {/* Response */}
      {response && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Thinking summary — repliable */}
          <div style={{
            borderRadius: '10px', border: '1px solid #2a2520',
            overflow: 'hidden', background: '#1a1815',
          }}>
            <button
              onClick={() => setThinkingOpen(o => !o)}
              style={{
                width: '100%', padding: '0.75rem 1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#8a7f72', fontSize: '0.82rem', textAlign: 'left',
              }}
            >
              <span>
                🔍 {response.thinking_summary.chunks_analyzed} passages analysés ·{' '}
                {response.thinking_summary.chunks_retained} retenus ·{' '}
                {response.thinking_summary.documents_retained.length} document(s) utilisé(s)
              </span>
              <span style={{ fontSize: '0.7rem' }}>{thinkingOpen ? '▲' : '▼'}</span>
            </button>

            {thinkingOpen && (
              <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #2a2520' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
                  {response.thinking_summary.steps.map((step, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      fontSize: '0.82rem', color: '#8a7f72',
                    }}>
                      <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: '#c4956a', flexShrink: 0,
                      }} />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Réponse principale */}
          <div style={{
            padding: '1.5rem', borderRadius: '12px',
            border: '1px solid #2a2520', background: '#1a1815',
            lineHeight: 1.7, fontSize: '0.95rem',
            whiteSpace: 'pre-wrap',
          }}>
            <div style={{
              fontSize: '0.72rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#c4956a',
              marginBottom: '0.75rem',
            }}>
              Réponse
            </div>
            {response.answer}
          </div>

          {/* Sources utilisées */}
          {response.used_sources.length > 0 && (
            <div style={{
              padding: '1rem 1.25rem', borderRadius: '10px',
              border: '1px solid #2a2520', background: '#1a1815',
            }}>
              <div style={{
                fontSize: '0.72rem', letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#6b6058',
                marginBottom: '0.75rem',
              }}>
                📄 Sources utilisées
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {response.used_sources.map((source, i) => (
                  <div key={i} style={{
                    padding: '0.65rem 0.9rem', borderRadius: '8px',
                    border: '1px solid #2a2520', background: '#0f0e0c',
                    fontSize: '0.82rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <span style={{
                        background: 'rgba(196,149,106,0.1)',
                        color: '#c4956a', padding: '0.1rem 0.5rem',
                        borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                      }}>
                        {source.filename}
                      </span>
                      {source.page && (
                        <span style={{ color: '#6b6058', fontSize: '0.75rem' }}>
                          p.{source.page}
                        </span>
                      )}
                    </div>
                    {source.excerpt && (
                      <div style={{ color: '#8a7f72', fontStyle: 'italic' }}>
                        « {source.excerpt} »
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}