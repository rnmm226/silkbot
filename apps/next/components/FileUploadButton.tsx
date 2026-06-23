// components/FileUploadButton.tsx
"use client";

import { useState, useRef } from 'react';
import { Paperclip, X, File, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadButtonProps {
  onFileUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  acceptedTypes?: string[];
  maxSize?: number; // en Mo
}

export function FileUploadButton({ 
  onFileUpload, 
  disabled = false,
  acceptedTypes = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'],
  maxSize = 10 // 10 Mo par défaut
}: FileUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setError(null);
    setSuccess(false);

    // Validation de la taille
    if (file.size > maxSize * 1024 * 1024) {
      setError(`Le fichier dépasse ${maxSize} Mo`);
      return;
    }

    // Validation du type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(fileExtension)) {
      setError(`Type de fichier non supporté. Types acceptés: ${acceptedTypes.join(', ')}`);
      return;
    }

    setIsUploading(true);

    try {
      await onFileUpload(file);
      setSuccess(true);
      // Reset le champ input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Cache le message de succès après 3 secondes
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemoveError = () => {
    setError(null);
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept={acceptedTypes.join(',')}
        disabled={disabled || isUploading}
        multiple={false}
      />
      
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={disabled || isUploading}
        className="h-8 w-8 rounded-lg hover:bg-accent transition-colors"
        title="Joindre un fichier"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : success ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </Button>

      {/* Indicateur de fichier en cours d'upload */}
      {isUploading && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-card border rounded-lg shadow-lg text-xs min-w-[200px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Upload en cours...</span>
          </div>
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-destructive/10 border border-destructive/30 rounded-lg shadow-lg text-xs min-w-[200px]">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
            <span className="text-destructive flex-1">{error}</span>
            <button
              onClick={handleRemoveError}
              className="shrink-0 hover:bg-destructive/20 rounded p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}