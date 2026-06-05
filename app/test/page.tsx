// app/test/page.tsx
'use client';

import { useState } from 'react';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';

export default function TestChatPage() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(() => {
    // Récupérer l'ID du chat depuis localStorage si existant
    if (typeof window !== 'undefined') {
      return localStorage.getItem('currentChatId');
    }
    return null;
  });

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    setResponse('');
    
    // Utiliser l'ID existant ou en créer un nouveau
    const currentChatId = chatId || crypto.randomUUID();
    
    if (!chatId) {
      setChatId(currentChatId);
      localStorage.setItem('currentChatId', currentChatId);
    }
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentChatId,
          message: {
            id: crypto.randomUUID(),
            role: 'user',
            parts: [{ type: 'text', text: message }]
          }
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `HTTP error! status: ${res.status}`);
      }

      // Lire le flux de réponse
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      let fullResponse = '';
      let buffer = '';
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              
              // Gérer les différents types d'événements
              if (parsed.type === 'text-delta') {
                fullResponse += parsed.delta;
                setResponse(fullResponse);
              } else if (parsed.type === 'text-start') {
                // Début du message
                console.log('Début du message');
              } else if (parsed.type === 'text-end') {
                // Fin du message
                console.log('Fin du message');
              }
            } catch (e) {
              console.log('Non-JSON:', data);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Erreur:', error);
      setResponse('Erreur: ' + (error as Error).message);
    } finally {
      setLoading(false);
      setMessage('');
    }
  };

  const newConversation = () => {
    setChatId(null);
    setMessage('');
    setResponse('');
    localStorage.removeItem('currentChatId');
  };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h1>Test Chat API</h1>
      
      {chatId && (
        <div style={{ 
          marginBottom: 10, 
          padding: 10, 
          background: '#e3f2fd', 
          borderRadius: 5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: 12 }}>Chat ID: {chatId.substring(0, 8)}...</span>
          <button onClick={newConversation} style={{ padding: '4px 8px' }}>
            ✨ Nouvelle conversation
          </button>
        </div>
      )}
      
      <div style={{ marginBottom: 10 }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Votre message..."
          rows={3}
          style={{ width: '100%', padding: 10, fontSize: 16, borderRadius: 8 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
      </div>
      
      <button 
        onClick={sendMessage} 
        disabled={loading}
        style={{ 
          padding: '10px 20px', 
          fontSize: 16,
          background: loading ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: 5,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Envoi en cours...' : 'Envoyer'}
      </button>
      
      {response && (
        <div style={{ 
          marginTop: 20, 
          padding: 15, 
          background: '#f5f5f5', 
          borderRadius: 8,
          borderLeft: '4px solid #0070f3'
        }}>
          <strong style={{ fontSize: 16 }}>🤖 Assistant:</strong>
          <div style={{ marginTop: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {response}
            {loading && <span className="cursor-blink">▊</span>}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .cursor-blink {
          animation: blink 1s infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}