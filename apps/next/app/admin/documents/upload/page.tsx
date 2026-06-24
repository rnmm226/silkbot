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
  BookOpen,
  Newspaper,
  Scale,
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
import { uploadDocument } from "@/lib/api/admin";

const acceptedTypes = ["application/pdf", "text/plain", "text/markdown"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type SourceType = "jort" | "jibaya" | "luca_pacioli";

function formatFileSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

const SOURCE_OPTIONS: { value: SourceType; label: string; icon: any; description: string }[] = [
  { 
    value: "jort", 
    label: "JORT", 
    icon: Newspaper,
    description: "Journal Officiel de la République Tunisienne" 
  },
  { 
    value: "jibaya", 
    label: "Jibaya", 
    icon: Scale,
    description: "Textes fiscaux et juridiques" 
  },
  { 
    value: "luca_pacioli", 
    label: "Luca Pacioli", 
    icon: BookOpen,
    description: "Articles et analyses comptables" 
  },
];

export default function AdminUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>("jort");
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

    try {
      // Simuler la progression
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      // ✅ Upload avec la source sélectionnée
      await uploadDocument(file, sourceType);
      
      clearInterval(interval);
      setUploadProgress(100);
      
      setSuccess(true);
      setTimeout(() => {
        router.push("/admin/documents");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'indexation");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
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
              <>
                {/* Sélecteur de source */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Type de source *
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {SOURCE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = sourceType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSourceType(option.value)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all duration-200",
                            isSelected
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          )}
                        >
                          <Icon className={cn(
                            "size-5",
                            isSelected ? "text-primary" : "text-muted-foreground"
                          )} />
                          <span className={cn(
                            "text-sm font-medium",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {option.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Zone de dépôt */}
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
              </>
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
                {/* Informations du fichier avec source */}
                <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background border">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs font-medium text-primary">
                        {SOURCE_OPTIONS.find(s => s.value === sourceType)?.label}
                      </span>
                    </div>
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