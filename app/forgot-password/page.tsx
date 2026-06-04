'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { FileUIPart } from 'ai';

export default function Page() {
  const { messages, sendMessage, status, error, stop } = useChat();
  const [input, setInput] = useState('');
  const [files] = useState<FileUIPart[]>([
    {
      type: 'file',
      filename: 'earth.png',
      mediaType: 'image/png',
      url: 'https://images.unsplash.com/photo-1614730321146-b6fd6e5da6f7?w=100',
    },
    {
      type: 'file',
      filename: 'moon.png',
      mediaType: 'image/png',
      url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=100',
    },
  ]);

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 bg-gray-50">
      {/* Header */}
      <div className="bg-white rounded-t-lg shadow-md p-4 mb-4">
        <h1 className="text-2xl font-bold text-center text-gray-800">
          Chat Assistant
        </h1>
        <p className="text-center text-gray-500 text-sm">
          Exemple avec fichiers intégrés
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 bg-white rounded-lg shadow-md">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p>💬 Commencez une conversation !</p>
            <p className="text-sm mt-2">
              Des exemples des images sont disponibles 
            </p>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="font-bold text-xs mb-1 opacity-70">
                {message.role === 'user' ? '👤 Vous' : '🤖 Assistant'}
              </div>
              
              {/* Contenu du message */}
              <div>
                {message.parts.map((part, index) => {
                  // Texte
                  if (part.type === 'text') {
                    return (
                      <div key={index} className="whitespace-pre-wrap">
                        {part.text}
                      </div>
                    );
                  }

                  // Image
                  if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
                    return (
                      <div key={index} className="mt-2">
                        <img 
                          src={part.url} 
                          alt={part.filename || 'Image'} 
                          className="max-w-full max-h-64 rounded-lg shadow-md object-contain"
                        />
                        <div className="text-xs mt-1 opacity-70">
                          📎 {part.filename}
                        </div>
                      </div>
                    );
                  }

                  // Autres fichiers
                  if (part.type === 'file') {
                    return (
                      <div key={index} className="mt-2">
                        <a 
                          href={part.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${
                            message.role === 'user'
                              ? 'bg-blue-500 text-white hover:bg-blue-700'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          📎 {part.filename}
                        </a>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Loading / Streaming Status */}
      {(status === 'submitted' || status === 'streaming') && (
        <div className="flex items-center justify-between p-3 bg-white rounded-lg shadow-md mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">
              {status === 'submitted' ? '📤 Envoi en cours...' : '✍️ L\'assistant écrit...'}
            </span>
          </div>
          <button
            onClick={() => stop()}
            className="text-red-500 text-sm hover:underline"
          >
            ⏹️ Stop
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-red-600 text-sm">
            ❌ Erreur: {error.message}
          </p>
        </div>
      )}

      {/* Fichiers statiques inclus */}
      <div className="mb-2 p-2 bg-white rounded-lg shadow-sm">
        <div className="text-xs text-gray-500 mb-2">📎 Fichiers joints à chaque message:</div>
        <div className="flex gap-3">
          {files.map((file, index) => (
            <div key={index} className="flex flex-col items-center">
              <img 
                src={file.url} 
                alt={file.filename}
                className="w-16 h-16 object-cover rounded-lg border border-gray-200"
              />
              <span className="text-xs text-gray-500 mt-1">{file.filename}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Formulaire d'envoi */}
      <form
        onSubmit={event => {
          event.preventDefault();
          if (input.trim()) {
            sendMessage({
              text: input,
              files,
            });
            setInput('');
          }
        }}
        className="bg-white rounded-lg shadow-md p-3"
      >
        <div className="flex gap-2">
          <div className="flex-1 border border-gray-300 rounded-lg px-3 py-1 focus-within:ring-2 focus-within:ring-blue-500 bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Écrivez votre message..."
              disabled={status !== 'ready'}
              className="w-full py-2 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={status !== 'ready' || !input.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Envoyer 📩
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-2 text-center">
          Les images Earth et Moon seront jointes automatiquement
        </div>
      </form>
    </div>
  );
}