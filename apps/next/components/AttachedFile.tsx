// components/AttachedFile.tsx
"use client";

import { File, X, FileText, Image, FileArchive, FileCode } from 'lucide-react';

interface AttachedFileProps {
  file: {
    id: string;
    name: string;
    size: number;
    type: string;
    url?: string;
  };
  onRemove?: (id: string) => void;
  readonly?: boolean;
}

const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return <FileText className="h-4 w-4" />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return <Image className="h-4 w-4" />;
    case 'zip':
    case 'rar':
    case '7z':
      return <FileArchive className="h-4 w-4" />;
    case 'js':
    case 'ts':
    case 'html':
    case 'css':
    case 'json':
      return <FileCode className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function AttachedFile({ file, onRemove, readonly = false }: AttachedFileProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg border border-border/50 group">
      <div className="text-muted-foreground">
        {getFileIcon(file.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{file.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {formatFileSize(file.size)}
        </div>
      </div>
      {!readonly && onRemove && (
        <button
          onClick={() => onRemove(file.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
        >
          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
}