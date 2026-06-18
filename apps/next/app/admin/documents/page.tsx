"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  File,
  FileText,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DocumentItem = {
  id: string;
  filename: string;
  segmentCount: number;
  createdAt: string;
  fileSize?: number;
  status?: "indexed" | "processing" | "error";
};

type Notice = { message: string; type: "success" | "error" | "info" };
type FileFilter = "all" | "pdf" | "text";

const ITEMS_PER_PAGE = 10;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-TN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

function getDocumentType(filename: string): FileFilter {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text";
  return "all";
}

function getFileIcon(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return FileText;
  return File;
}

function getFileColorClass(filename: string) {
  return filename.toLowerCase().endsWith(".pdf") ? "text-red-500" : "text-muted-foreground";
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const map = {
    indexed: { label: "Indexé", className: "text-green-700 bg-green-50 border-green-200" },
    processing: { label: "En cours", className: "text-yellow-700 bg-yellow-50 border-yellow-200" },
    error: { label: "Erreur", className: "text-red-700 bg-red-50 border-red-200" },
  } as const;
  const config = map[status as keyof typeof map];
  if (!config) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [segments, setSegments] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FileFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [segmentError, setSegmentError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const noticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showNotice = useCallback((message: string, type: Notice["type"]) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ message, type });
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3500);
  }, []);

  useEffect(() => () => { if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current); }, []);

  const fetchDocuments = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      try {
        const res = await fetch("/api/admin/document-ref");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
        setDocuments(Array.isArray(data) ? data : data.documents ?? []);
        setCurrentPage(1);
      } catch (err) {
        showNotice(err instanceof Error ? err.message : "Erreur de chargement", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showNotice],
  );

  useEffect(() => { void fetchDocuments(); }, [fetchDocuments]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesQuery =
        doc.filename.toLowerCase().includes(query.toLowerCase()) ||
        doc.id.toLowerCase().includes(query.toLowerCase());
      const type = getDocumentType(doc.filename);
      return matchesQuery && (filter === "all" || type === filter);
    });
  }, [documents, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE));

  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDocuments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDocuments, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [query, filter]);

  const loadSegments = async (doc: DocumentItem) => {
    setSelectedDocument(doc);
    setSegments([]);
    setSegmentsLoading(true);
    setSegmentError(null);

    try {
      const res = await fetch(`/api/admin/document-ref/${doc.id}/segments`);
      const text = await res.text();
      if (!text.trim()) {
        setSegmentError("Aucune donnée retournée par l'API");
        return;
      }
      const data = JSON.parse(text);
      if (!res.ok) {
        setSegmentError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      const list: string[] =
        data.segments ?? (Array.isArray(data) ? data : data.data ?? []);
      setSegments(list);
      if (list.length === 0) setSegmentError("Aucun segment disponible pour ce document");
    } catch (err) {
      setSegmentError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSegmentsLoading(false);
    }
  };

  const deleteDocument = async (doc: DocumentItem) => {
    if (!confirm(`Supprimer "${doc.filename}" et ses ${doc.segmentCount} segments ?`)) return;
    setDeletingId(doc.id);
    try {
      const res = await fetch("/api/admin/document-ref", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Suppression impossible");
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (selectedDocument?.id === doc.id) {
        setSelectedDocument(null);
        setSegments([]);
        setSegmentError(null);
      }
      showNotice("Document supprimé", "success");
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Erreur de suppression", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const copyId = async (id: string) => {
    await navigator.clipboard.writeText(id).catch(() => {});
    showNotice("Identifiant copié", "success");
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {notice && (
        <div
          role="alert"
          aria-live="polite"
          className={cn(
            "fixed right-4 top-4 z-50 flex max-w-sm items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-sm shadow-lg",
            notice.type === "error"
              ? "border-destructive/25 text-destructive"
              : notice.type === "info"
                ? "border-blue-500/25 text-blue-600"
                : "border-primary/25 text-foreground",
          )}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <AlertCircle className="size-4" />
          )}
          {notice.message}
        </div>
      )}

      {/* En-tête */}
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-base font-medium">Documents indexés</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {documents.length} source(s) · {documents.reduce((s, d) => s + d.segmentCount, 0).toLocaleString("fr-FR")} segments au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDocuments(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            Actualiser
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/documents/upload">
              <Upload className="size-3.5" />
              Importer
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Colonne principale */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          {/* Liste des documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Sources disponibles</CardTitle>
              <CardDescription className="text-xs">
                {filteredDocuments.length} document(s) · page {currentPage}/{totalPages}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Filtres */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher par nom ou identifiant…"
                    className="pl-8 text-sm"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="shrink-0">
                      <Filter className="size-3.5" />
                      {filter === "all" ? "Tous" : filter === "pdf" ? "PDF" : "Texte"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuLabel className="text-xs">Type</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFilter("all")}>Tous</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilter("pdf")}>PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilter("text")}>Texte</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Tableau */}
              <div className="overflow-hidden rounded-lg border">
                <div className="hidden grid-cols-[1fr_80px_70px_90px_36px] border-b bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Document</span>
                  <span className="text-center">Segments</span>
                  <span className="text-center">Taille</span>
                  <span className="text-center">Importé</span>
                  <span />
                </div>

                {loading ? (
                  <div className="space-y-1.5 p-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : paginatedDocuments.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 p-8 text-center">
                    <FileText className="size-7 text-muted-foreground" />
                    <p className="text-sm font-medium">Aucun document trouvé</p>
                    <p className="text-xs text-muted-foreground">
                      Modifiez la recherche ou importez une nouvelle source.
                    </p>
                  </div>
                ) : (
                  paginatedDocuments.map((doc, idx) => {
                    const Icon = getFileIcon(doc.filename);
                    return (
                      <div
                        key={doc.id}
                        className={cn(
                          "grid gap-2 px-3 py-2.5 transition-colors hover:bg-muted/20 md:grid-cols-[1fr_80px_70px_90px_36px] md:items-center",
                          idx !== paginatedDocuments.length - 1 && "border-b",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => void loadSegments(doc)}
                          className="flex min-w-0 items-center gap-2.5 text-left"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                            <Icon className={cn("size-4", getFileColorClass(doc.filename))} />
                          </div>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {doc.filename}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="block text-[11px] text-muted-foreground">
                                {doc.id.slice(0, 8)}…
                              </span>
                              {doc.status && <StatusBadge status={doc.status} />}
                            </span>
                          </span>
                        </button>

                        <span className="w-fit rounded border bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground md:mx-auto">
                          {doc.segmentCount}
                        </span>
                        <span className="text-xs text-muted-foreground md:text-center">
                          {doc.fileSize ? formatFileSize(doc.fileSize) : "—"}
                        </span>
                        <span className="text-xs text-muted-foreground md:text-center">
                          {formatDate(doc.createdAt)}
                        </span>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Options">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => void loadSegments(doc)}>
                              <Eye className="size-4" /> Voir les segments
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void copyId(doc.id)}>
                              <Copy className="size-4" /> Copier l'identifiant
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={deletingId === doc.id}
                              onClick={() => void deleteDocument(doc)}
                            >
                              <Trash2 className="size-4" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination */}
              {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span>
                    {filteredDocuments.length} document(s) · page {currentPage}/{totalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="text-xs"
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="text-xs"
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panneau aperçu segments */}
        <aside className="hidden w-80 flex-shrink-0 border-l xl:flex xl:flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-medium">Aperçu des segments</p>
              <p className="text-xs text-muted-foreground">
                {selectedDocument
                  ? `${segments.length} segment(s)`
                  : "Sélectionnez un document"}
              </p>
            </div>
            {selectedDocument && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setSelectedDocument(null);
                  setSegments([]);
                  setSegmentError(null);
                }}
                aria-label="Fermer l'aperçu"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!selectedDocument ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Eye className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Aucun document sélectionné</p>
                <p className="max-w-52 text-xs text-muted-foreground">
                  Cliquez sur un document de la liste pour afficher ses segments.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="truncate text-sm font-medium">{selectedDocument.filename}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedDocument.id.slice(0, 16)}… · {selectedDocument.segmentCount} segments
                  </p>
                </div>

                {segmentError && (
                  <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                    {segmentError}
                  </p>
                )}

                {segmentsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : segments.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Aucun segment disponible
                  </div>
                ) : (
                  <div className="space-y-2">
                    {segments.slice(0, 20).map((seg, i) => (
                      <div
                        key={`${selectedDocument.id}-${i}`}
                        className="rounded-lg border bg-background p-3"
                      >
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Segment {i + 1}
                        </p>
                        <p className="line-clamp-4 text-xs text-muted-foreground">{seg}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}