"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const acceptedTypes = ["application/pdf", "text/plain", "text/markdown"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function AdminUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    setSuccess(false);

    if (!acceptedTypes.includes(selectedFile.type)) {
      setError("Format non supporté. Utilisez PDF, TXT ou Markdown.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`Taille maximale dépassée (${formatFileSize(MAX_FILE_SIZE)})`);
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/document-ref/upload");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploading(false);
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300) {
          setError(body?.error ?? "Erreur lors de l'indexation");
          return;
        }
        setSuccess(true);
        setTimeout(() => {
          router.push("/admin/documents");
        }, 2000);
      } catch {
        setError("Erreur lors du traitement de la réponse");
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError("Connexion impossible lors de l'envoi");
    };

    xhr.send(formData);
  };

  const handleClear = () => {
    setFile(null);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* En-tête */}
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-base font-medium">Importer un document</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ajoutez une nouvelle source à la base documentaire
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/admin/documents")}>
          <ArrowLeft className="size-3.5" />
          Retour
        </Button>
      </header>

      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Nouvelle source</CardTitle>
            <CardDescription className="text-xs">
              PDF, TXT ou Markdown — {formatFileSize(MAX_FILE_SIZE)} maximum
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!file && !success ? (
              <div
                className={cn(
                  "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/20 p-8 text-center transition-colors hover:bg-muted/40",
                  dragOver && "border-primary bg-primary/5"
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const droppedFile = e.dataTransfer.files[0];
                  if (droppedFile) handleFileSelect(droppedFile);
                }}
              >
                <Upload className="size-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    Déposer un fichier ou cliquer pour parcourir
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    PDF, TXT, MD — {formatFileSize(MAX_FILE_SIZE)} max
                  </p>
                </div>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) handleFileSelect(selected);
                  }}
                />
              </div>
            ) : success ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <CheckCircle2 className="size-12 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-600">
                    Document indexé avec succès !
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Redirection vers la liste des documents…
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background border">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleClear}
                    disabled={uploading}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </div>
                )}

                {uploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Indexation en cours…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        Indexation…
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" />
                        Indexer
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClear}
                    disabled={uploading}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}