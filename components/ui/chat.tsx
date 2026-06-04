'use client';

import { UIMessage, useChat } from '@ai-sdk/react';
import { DefaultChatTransport, createIdGenerator } from 'ai';
import { useState, useRef } from 'react';

interface ChatProps {
  id: string;
  initialMessages?: UIMessage[];
}

export default function Chat({ id, initialMessages }: ChatProps) {
  const [input, setInput] = useState<string>('');
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status, error, stop } = useChat({
    id,
    messages: initialMessages,
    generateId: createIdGenerator({
      prefix: 'msgc',
      size: 16,
    }),
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest({
        messages: msgs,
        id: chatId,
      }: {
        messages: UIMessage[];
        id: string;
      }) {
        return {
          body: {
            message: msgs[msgs.length - 1],
            id: chatId,
          },
        };
      },
    }),
  });

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

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 bg-gray-50">
      {/* Header */}
      <div className="bg-white rounded-t-lg shadow-md p-4 mb-4">
        <h1 className="text-2xl font-bold text-center text-gray-800">
          Chat Assistant
        </h1>
        <p className="text-center text-gray-500 text-sm">ID: {id}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 bg-white rounded-lg shadow-md">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p>💬 Commencez une conversation !</p>
            <p className="text-sm mt-2">
              Vous pouvez aussi joindre des fichiers 📎
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="font-bold text-xs mb-1 opacity-70">
                {m.role === 'user' ? '👤 Vous' : '🤖 Assistant'}
              </div>
              <div>{m.parts.map((part, index) => renderPart(part, index))}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Loading Status */}
      {(status === 'submitted' || status === 'streaming') && (
        <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">
              {status === 'submitted' ? 'Envoi...' : "L'assistant écrit..."}
            </span>
          </div>
          <button
            type="button"
            onClick={() => stop()}
            className="text-red-500 text-sm hover:underline"
          >
            Stop
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-red-600 text-sm">Erreur: {error.message}</p>
        </div>
      )}

      {/* Selected files preview */}
      {files && files.length > 0 && (
        <div className="flex gap-2 mb-2 p-2 bg-gray-100 rounded-lg overflow-x-auto">
          {Array.from(files).map((file, index) => (
            <div
              key={index}
              className="text-sm text-gray-600 bg-white px-2 py-1 rounded shadow-sm whitespace-nowrap"
            >
              📎 {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex items-center gap-2 flex-1 border border-gray-300 rounded-lg px-3 py-1 focus-within:ring-2 focus-within:ring-blue-500 bg-white">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-500 hover:text-gray-700"
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
            placeholder="Type a message..."
            disabled={status !== 'ready'}
            className="flex-1 py-2 focus:outline-none disabled:bg-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={
            status !== 'ready' ||
            (!input.trim() && (!files || files.length === 0))
          }
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}