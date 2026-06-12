"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  FileText,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
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
};

type AccountItem = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  accountCount: number;
  chatCount: number;
  sessionCount: number;
  isCurrentUser: boolean;
};

type Notice = {
  message: string;
  type: "success" | "error";
};

type FileFilter = "all" | "pdf" | "text";

const acceptedTypes = ["application/pdf", "text/plain", "text/markdown"];

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

function getDocumentType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text";
  return "all";
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [segments, setSegments] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [filter, setFilter] = useState<FileFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState("aucun fichier");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotice = useCallback((message: string, type: Notice["type"]) => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const fetchDocuments = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/admin/document-ref");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chargement impossible");
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de chargement";
      showNotice(message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showNotice]);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/accounts");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Comptes indisponibles");
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de chargement des comptes";
      showNotice(message, "error");
    }
  }, [showNotice]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDocuments();
      void fetchAccounts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchAccounts, fetchDocuments]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const matchesQuery =
        document.filename.toLowerCase().includes(query.toLowerCase()) ||
        document.id.toLowerCase().includes(query.toLowerCase());
      const type = getDocumentType(document.filename);
      const matchesFilter = filter === "all" || type === filter;
      return matchesQuery && matchesFilter;
    });
  }, [documents, filter, query]);

  const totalSegments = useMemo(
    () => documents.reduce((total, document) => total + document.segmentCount, 0),
    [documents],
  );

  const latestDocument = documents[0];

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const search = accountQuery.toLowerCase();
      return (
        account.name.toLowerCase().includes(search) ||
        account.email.toLowerCase().includes(search) ||
        account.id.toLowerCase().includes(search)
      );
    });
  }, [accountQuery, accounts]);

  const verifiedAccounts = useMemo(
    () => accounts.filter((account) => account.emailVerified).length,
    [accounts],
  );

  const uploadFile = async (file: File) => {
    if (!acceptedTypes.includes(file.type)) {
      showNotice("Format non supporte. Utilisez PDF, TXT ou Markdown.", "error");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setSelectedFileSize(formatFileSize(file.size));

    const formData = new FormData();
    formData.append("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/admin/document-ref/upload");

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      setUploadProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = async () => {
      setUploading(false);
      setUploadProgress(100);

      let body: { error?: string; filename?: string; chunks?: number } = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {
        body = {};
      }

      if (request.status < 200 || request.status >= 300) {
        showNotice(body.error || "Erreur pendant l'indexation", "error");
        return;
      }

      showNotice(
        `${body.filename || file.name} indexe avec succes`,
        "success",
      );
      await fetchDocuments(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    request.onerror = () => {
      setUploading(false);
      showNotice("Connexion impossible pendant l'upload", "error");
    };

    request.send(formData);
  };

  const loadSegments = async (document: DocumentItem) => {
    setSelectedDocument(document);
    setSegments([]);
    setSegmentsLoading(true);

    try {
      const response = await fetch(`/api/admin/document-ref/${document.id}/segments`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Segments indisponibles");
      setSegments(Array.isArray(data.segments) ? data.segments : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de lecture";
      showNotice(message, "error");
    } finally {
      setSegmentsLoading(false);
    }
  };

  const deleteDocument = async (document: DocumentItem) => {
    const confirmed = window.confirm(
      `Supprimer "${document.filename}" et ses ${document.segmentCount} segments ?`,
    );
    if (!confirmed) return;

    setDeletingId(document.id);

    try {
      const response = await fetch("/api/admin/document-ref", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: document.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Suppression impossible");

      setDocuments((current) => current.filter((item) => item.id !== document.id));
      if (selectedDocument?.id === document.id) {
        setSelectedDocument(null);
        setSegments([]);
      }
      showNotice("Document supprime", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de suppression";
      showNotice(message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const copyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    showNotice("Identifiant copie", "success");
  };

  const toggleAccountVerification = async (account: AccountItem) => {
    setUpdatingAccountId(account.id);

    try {
      const response = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: account.id,
          emailVerified: !account.emailVerified,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Modification impossible");

      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id
            ? { ...item, emailVerified: !account.emailVerified }
            : item,
        ),
      );
      showNotice("Statut email mis a jour", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de modification";
      showNotice(message, "error");
    } finally {
      setUpdatingAccountId(null);
    }
  };

  const deleteAccount = async (account: AccountItem) => {
    const confirmed = window.confirm(
      `Supprimer le compte "${account.email}" ? Ses conversations seront detachees.`,
    );
    if (!confirmed) return;

    setDeletingAccountId(account.id);

    try {
      const response = await fetch("/api/admin/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Suppression impossible");

      setAccounts((current) => current.filter((item) => item.id !== account.id));
      showNotice("Compte supprime", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de suppression";
      showNotice(message, "error");
    } finally {
      setDeletingAccountId(null);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      {notice && (
        <div
          className={cn(
            "fixed right-4 top-4 z-50 flex max-w-sm animate-fadeUp items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-sm shadow-lg",
            notice.type === "success"
              ? "border-primary/25 text-foreground"
              : "border-destructive/25 text-destructive",
          )}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <AlertCircle className="size-4" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 animate-fadeUp sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Administration
            </p>
            <h1 className="font-serif text-3xl font-semibold tracking-normal">
              Base documentaire
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Pilotez les sources juridiques indexees pour SilkBot.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => fetchDocuments(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              Actualiser
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="size-4" />
              Importer
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="animate-fadeUp [animation-delay:60ms]">
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Sources disponibles</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{documents.length}</span>
              <FileText className="size-8 text-primary" />
            </CardContent>
          </Card>
          <Card className="animate-fadeUp [animation-delay:120ms]">
            <CardHeader>
              <CardTitle>Segments</CardTitle>
              <CardDescription>Passages consultables</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{totalSegments}</span>
              <Database className="size-8 text-primary" />
            </CardContent>
          </Card>
          <Card className="animate-fadeUp [animation-delay:180ms]">
            <CardHeader>
              <CardTitle>Dernier import</CardTitle>
              <CardDescription>
                {latestDocument ? formatDate(latestDocument.createdAt) : "Aucun document"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="truncate text-sm font-medium">
                {latestDocument?.filename || "En attente d'une source"}
              </p>
            </CardContent>
          </Card>
          <Card className="animate-fadeUp [animation-delay:240ms]">
            <CardHeader>
              <CardTitle>Comptes</CardTitle>
              <CardDescription>Utilisateurs inscrits</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{accounts.length}</span>
              <Users className="size-8 text-primary" />
            </CardContent>
          </Card>
          <Card className="animate-fadeUp [animation-delay:300ms]">
            <CardHeader>
              <CardTitle>Emails verifies</CardTitle>
              <CardDescription>Comptes confirmes</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{verifiedAccounts}</span>
              <ShieldCheck className="size-8 text-primary" />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="animate-fadeUp">
              <CardHeader>
                <CardTitle>Nouvelle source</CardTitle>
                <CardDescription>
                  PDF, TXT ou Markdown. L&apos;indexation peut prendre quelques secondes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(false);
                    const file = event.dataTransfer.files[0];
                    if (file) uploadFile(file);
                  }}
                  className={cn(
                    "flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/25 p-6 text-center transition-all hover:bg-muted/45",
                    dragOver && "border-primary bg-primary/5 ring-3 ring-primary/15",
                    uploading && "cursor-wait opacity-70",
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadFile(file);
                    }}
                  />
                  <span className="flex size-11 items-center justify-center rounded-lg bg-background ring-1 ring-border">
                    <Upload className="size-5 text-primary" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      Deposez un fichier ici ou cliquez pour parcourir
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Formats acceptes: PDF, TXT, MD
                    </p>
                  </div>
                  {uploading && (
                    <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </button>
              </CardContent>
            </Card>

            <Card className="animate-fadeUp">
              <CardHeader>
                <CardTitle>Documents indexes</CardTitle>
                <CardDescription>
                  Recherchez, inspectez ou supprimez une source.
                </CardDescription>
                <CardAction className="hidden sm:block">
                  <span className="text-xs text-muted-foreground">
                    {filteredDocuments.length} resultat(s)
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Rechercher par nom ou identifiant"
                      className="pl-8"
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="justify-start">
                        <Filter className="size-4" />
                        {filter === "all" ? "Tous" : filter === "pdf" ? "PDF" : "Texte"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuLabel>Filtrer</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setFilter("all")}>
                        Tous
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setFilter("pdf")}>
                        PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setFilter("text")}>
                        Texte
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <div className="hidden grid-cols-[1fr_100px_120px_44px] border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                    <span>Source</span>
                    <span className="text-center">Segments</span>
                    <span className="text-center">Date</span>
                    <span />
                  </div>

                  {loading ? (
                    <div className="space-y-2 p-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : filteredDocuments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                      <FileText className="size-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Aucun document trouve</p>
                      <p className="text-xs text-muted-foreground">
                        Modifiez la recherche ou importez une nouvelle source.
                      </p>
                    </div>
                  ) : (
                    filteredDocuments.map((document, index) => (
                      <div
                        key={document.id}
                        className={cn(
                          "grid gap-3 px-3 py-3 transition-colors hover:bg-muted/30 md:grid-cols-[1fr_100px_120px_44px] md:items-center",
                          index !== filteredDocuments.length - 1 && "border-b",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => loadSegments(document)}
                          className="flex min-w-0 items-center gap-3 text-left"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <FileText className="size-4 text-primary" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {document.filename}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {document.id}
                            </span>
                          </span>
                        </button>

                        <span className="w-fit rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary md:mx-auto">
                          {document.segmentCount}
                        </span>
                        <span className="text-xs text-muted-foreground md:text-center">
                          {formatDate(document.createdAt)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="justify-self-end">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => loadSegments(document)}>
                              <Eye className="size-4" />
                              Voir segments
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyId(document.id)}>
                              <Copy className="size-4" />
                              Copier ID
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => deleteDocument(document)}
                              disabled={deletingId === document.id}
                            >
                              <Trash2 className="size-4" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="animate-fadeUp lg:sticky lg:top-6 lg:self-start">
            <CardHeader>
              <CardTitle>Apercu des segments</CardTitle>
              <CardDescription>
                Controle rapide du contenu indexe.
              </CardDescription>
              {selectedDocument && (
                <CardAction>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setSelectedDocument(null);
                      setSegments([]);
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {!selectedDocument ? (
                <div className="flex min-h-72 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
                  <Eye className="size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Selectionnez un document</p>
                  <p className="max-w-56 text-xs text-muted-foreground">
                    Les premiers segments apparaissent ici pour verification.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="truncate text-sm font-medium">
                      {selectedDocument.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedDocument.segmentCount} segments
                    </p>
                  </div>

                  {segmentsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton key={index} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : segments.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Aucun segment disponible.
                    </div>
                  ) : (
                    <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                      {segments.slice(0, 20).map((segment, index) => (
                        <div
                          key={`${selectedDocument.id}-${index}`}
                          className="rounded-lg border bg-background p-3 text-sm"
                        >
                          <div className="mb-1 text-xs font-medium text-muted-foreground">
                            Segment {index + 1}
                          </div>
                          <p className="line-clamp-5 text-muted-foreground">
                            {segment}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="animate-fadeUp">
          <CardHeader>
            <CardTitle>Gestion des comptes</CardTitle>
            <CardDescription>
              Consultez les utilisateurs, leurs sessions et leurs conversations.
            </CardDescription>
            <CardAction className="hidden sm:block">
              <span className="text-xs text-muted-foreground">
                {filteredAccounts.length} compte(s)
              </span>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={accountQuery}
                  onChange={(event) => setAccountQuery(event.target.value)}
                  placeholder="Rechercher un nom, email ou ID"
                  className="pl-8"
                />
              </div>
              <Button variant="outline" onClick={() => void fetchAccounts()}>
                <RefreshCw className="size-4" />
                Recharger comptes
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="hidden grid-cols-[1fr_110px_90px_110px_44px] border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
                <span>Utilisateur</span>
                <span className="text-center">Statut</span>
                <span className="text-center">Chats</span>
                <span className="text-center">Inscrit</span>
                <span />
              </div>

              {loading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                  <Users className="size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Aucun compte trouve</p>
                  <p className="text-xs text-muted-foreground">
                    Essayez une autre recherche.
                  </p>
                </div>
              ) : (
                filteredAccounts.map((account, index) => (
                  <div
                    key={account.id}
                    className={cn(
                      "grid gap-3 px-3 py-3 transition-colors hover:bg-muted/30 lg:grid-cols-[1fr_110px_90px_110px_44px] lg:items-center",
                      index !== filteredAccounts.length - 1 && "border-b",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                        {account.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "?"}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {account.name}
                          </span>
                          {account.isCurrentUser && (
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              Vous
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {account.email}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span>{account.sessionCount} session(s)</span>
                          <span>{account.accountCount} liaison(s)</span>
                        </span>
                      </span>
                    </div>

                    <span
                      className={cn(
                        "w-fit rounded-md px-2 py-1 text-xs font-medium lg:mx-auto",
                        account.emailVerified
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {account.emailVerified ? "Verifie" : "Non verifie"}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground lg:justify-center">
                      <Database className="size-3" />
                      {account.chatCount}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground lg:justify-center">
                      <CalendarDays className="size-3" />
                      {formatDate(account.createdAt)}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="justify-self-end">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>Compte</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => copyId(account.id)}>
                          <Copy className="size-4" />
                          Copier ID
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleAccountVerification(account)}
                          disabled={updatingAccountId === account.id}
                        >
                          {account.emailVerified ? (
                            <UserX className="size-4" />
                          ) : (
                            <UserCheck className="size-4" />
                          )}
                          {account.emailVerified ? "Marquer non verifie" : "Verifier email"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={
                            account.isCurrentUser || deletingAccountId === account.id
                          }
                          onClick={() => deleteAccount(account)}
                        >
                          <Trash2 className="size-4" />
                          Supprimer compte
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Conseil: gardez les documents courts et bien structures pour ameliorer la qualite
          des reponses. Taille du dernier fichier selectionne affichee pendant l&apos;import:{" "}
          {selectedFileSize}
        </div>
      </section>
    </main>
  );
}
