"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Bot,
  CalendarDays,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  File,
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
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type DocumentItem = {
  id: string;
  filename: string;
  segmentCount: number;
  createdAt: string;
  fileSize?: number;
  fileType?: string;
  status?: "indexed" | "processing" | "error";
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
  type: "success" | "error" | "info";
};

type FileFilter = "all" | "pdf" | "text";

const acceptedTypes = ["application/pdf", "text/plain", "text/markdown"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const ITEMS_PER_PAGE = 5;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-TN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function getFileIcon(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return FileText;
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return File;
  if (lower.endsWith(".txt")) return FileText;
  if (lower.endsWith(".md")) return File;
  return File;
}

function getFileColor(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "text-red-500";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "text-blue-500";
  if (lower.endsWith(".txt")) return "text-gray-500";
  if (lower.endsWith(".md")) return "text-purple-500";
  return "text-primary";
}

function getStatusBadge(status?: string) {
  switch (status) {
    case "indexed":
      return (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="size-3" />
          Indexé
        </span>
      );
    case "processing":
      return (
        <span className="flex items-center gap-1 text-xs text-yellow-600">
          <RefreshCw className="size-3 animate-spin" />
          En cours
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="size-3" />
          Erreur
        </span>
      );
    default:
      return null;
  }
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
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState("aucun fichier");
  const [segmentError, setSegmentError] = useState<string | null>(null);
  const router = useRouter()
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllDocuments, setShowAllDocuments] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const noticeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showNotice = useCallback((message: string, type: Notice["type"]) => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }

    setNotice({ message, type });
    noticeTimeoutRef.current = setTimeout(() => {
      setNotice(null);
      noticeTimeoutRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  const fetchDocuments = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch("/api/admin/document-ref", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const text = await response.text();
        console.log("📄 Réponse brute (documents):", text.substring(0, 200) + "...");
        
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error("❌ Erreur de parsing JSON:", parseError);
          console.error("📄 Réponse brute complète:", text);
          throw new Error(`Réponse JSON invalide: ${text.substring(0, 100)}`);
        }

        if (!response.ok) {
          throw new Error(data.error || `Erreur ${response.status}: ${response.statusText}`);
        }

        if (Array.isArray(data)) {
          setDocuments(data);
        } else if (data.documents && Array.isArray(data.documents)) {
          setDocuments(data.documents);
        } else {
          console.warn("⚠️ Format inattendu:", data);
          setDocuments([]);
        }
        
        setCurrentPage(1);
      } catch (error) {
        console.error("❌ Erreur fetchDocuments:", error);
        if (error instanceof Error && error.name === "AbortError") {
          showNotice("La requête a expiré, veuillez réessayer", "error");
        } else {
          const message = error instanceof Error ? error.message : "Erreur de chargement";
          showNotice(`Erreur: ${message}`, "error");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showNotice],
  );

  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch("/api/admin/accounts", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await response.text();
      console.log("📄 Réponse brute (comptes):", text.substring(0, 200) + "...");
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("❌ Erreur de parsing JSON (comptes):", parseError);
        throw new Error("Réponse JSON invalide pour les comptes");
      }

      if (!response.ok) {
        throw new Error(data.error || `Erreur ${response.status}`);
      }

      if (Array.isArray(data)) {
        setAccounts(data);
      } else if (data.accounts && Array.isArray(data.accounts)) {
        setAccounts(data.accounts);
      } else {
        console.warn("⚠️ Format inattendu pour les comptes:", data);
        setAccounts([]);
      }
    } catch (error) {
      console.error("❌ Erreur fetchAccounts:", error);
      const message = error instanceof Error ? error.message : "Erreur de chargement des comptes";
      showNotice(`Erreur comptes: ${message}`, "error");
    } finally {
      setAccountsLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    void fetchDocuments();
    void fetchAccounts();
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

  const paginatedDocuments = useMemo(() => {
    if (showAllDocuments) return filteredDocuments;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredDocuments.slice(startIndex, endIndex);
  }, [filteredDocuments, currentPage, showAllDocuments]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE);
  }, [filteredDocuments]);

  const totalSegments = useMemo(
    () => documents.reduce((total, document) => total + document.segmentCount, 0),
    [documents],
  );

  const latestDocument = useMemo(() => documents[0], [documents]);

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
    if (!file.name || file.name.trim() === "") {
      showNotice("Le fichier n'a pas de nom valide", "error");
      return;
    }

    if (!acceptedTypes.includes(file.type)) {
      showNotice("Format non supporté. Utilisez PDF, TXT ou Markdown.", "error");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showNotice(
        `Le fichier dépasse la taille maximale de ${formatFileSize(MAX_FILE_SIZE)}`,
        "error",
      );
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadingFileName(file.name);
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
      setUploadingFileName(null);

      try {
        const responseText = request.responseText;
        console.log("📄 Réponse upload:", responseText);
        
        let body = {};
        try {
          body = JSON.parse(responseText);
        } catch {
          console.warn("⚠️ Réponse non-JSON pour l'upload");
        }

        if (request.status < 200 || request.status >= 300) {
          const errorMsg = (body as any)?.error || "Erreur pendant l'indexation";
          showNotice(errorMsg, "error");
          return;
        }

        showNotice(`${(body as any)?.filename || file.name} indexé avec succès`, "success");
        await fetchDocuments(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (error) {
        console.error("❌ Erreur upload:", error);
        showNotice("Erreur lors du traitement de la réponse", "error");
      }
    };

    request.onerror = () => {
      setUploading(false);
      setUploadingFileName(null);
      showNotice("Connexion impossible pendant l'upload", "error");
    };

    request.send(formData);
  };

  const loadSegments = async (document: DocumentItem) => {
    setSelectedDocument(document);
    setSegments([]);
    setSegmentsLoading(true);
    setSegmentError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`/api/admin/document-ref/${document.id}/segments`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await response.text();
      console.log(`📄 Réponse segments pour ${document.id}:`, text || "(réponse vide)");

      // ✅ Si la réponse est vide, on génère des données de démonstration
      if (!text || text.trim() === "") {
        console.warn("⚠️ Réponse vide, utilisation de données de démonstration");
        const demoSegments = [
          `📄 Document: ${document.filename}`,
          `🔍 Analyse juridique du document`,
          `📝 Points clés à retenir`,
          `⚖️ Références légales`,
          `📋 Résumé des dispositions`,
          `✅ Conclusion et recommandations`
        ];
        setSegments(demoSegments);
        setSegmentsLoading(false);
        setSegmentError("API non disponible - Affichage de démonstration");
        showNotice(`ℹ️ ${demoSegments.length} segments de démonstration générés`, "info");
        return;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("❌ Erreur parsing segments:", parseError);
        console.error("📄 Réponse brute:", text);
        // ✅ En cas d'erreur de parsing, on génère des segments de démonstration
        const fallbackSegments = [
          `📄 ${document.filename}`,
          `⚠️ Erreur de format des données`,
          `💡 Affichage de segments de démonstration`,
          `Segment 1: Contenu juridique`,
          `Segment 2: Analyse des clauses`,
          `Segment 3: Références et jurisprudence`,
        ];
        setSegments(fallbackSegments);
        setSegmentsLoading(false);
        setSegmentError("Format de données invalide - Affichage de démonstration");
        showNotice("Format de données invalide, affichage de démonstration", "info");
        return;
      }

      if (!response.ok) {
        const errorMsg = data.error || `Erreur ${response.status}`;
        console.error("❌ Erreur API segments:", errorMsg);
        // ✅ En cas d'erreur API, on génère des segments de démonstration
        const demoData = [
          `📄 Document: ${document.filename}`,
          `⚠️ L'API a retourné une erreur: ${errorMsg}`,
          `💡 Affichage de segments de démonstration`,
          `Segment 1: Contenu juridique`,
          `Segment 2: Analyse des clauses`,
          `Segment 3: Références légales`,
        ];
        setSegments(demoData);
        setSegmentsLoading(false);
        setSegmentError(`Erreur API: ${errorMsg}`);
        showNotice("Erreur API, affichage de démonstration", "info");
        return;
      }

      // ✅ Extraction des segments
      let segmentsList: string[] = [];
      if (data.segments && Array.isArray(data.segments)) {
        segmentsList = data.segments;
      } else if (Array.isArray(data)) {
        segmentsList = data;
      } else if (data.data && Array.isArray(data.data)) {
        segmentsList = data.data;
      } else {
        console.warn("⚠️ Format de segments inattendu:", data);
        // ✅ Si le format est inattendu, on cherche des segments dans toutes les propriétés
        for (const key of Object.keys(data)) {
          if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === "string") {
            segmentsList = data[key];
            console.log(`✅ Segments trouvés dans la propriété "${key}"`);
            break;
          }
        }
        // Si toujours rien, on génère des données de démonstration
        if (segmentsList.length === 0) {
          segmentsList = [
            `📄 ${document.filename}`,
            `📝 Format de données inattendu`,
            `💡 Affichage de démonstration`,
            `Segment 1: Contenu`,
            `Segment 2: Analyse`,
          ];
          setSegmentError("Format inconnu - Affichage de démonstration");
        }
      }

      console.log(`✅ ${segmentsList.length} segments chargés`);
      setSegments(segmentsList);
      
      if (segmentsList.length === 0) {
        setSegmentError("Aucun segment trouvé dans la réponse");
        showNotice("Aucun segment trouvé", "info");
      } else {
        setSegmentError(null);
        showNotice(`${segmentsList.length} segments chargés avec succès`, "success");
      }
      
    } catch (error) {
      console.error("❌ Erreur loadSegments:", error);
      // ✅ En cas d'erreur, on génère des segments de démonstration
      const fallbackSegments = [
        `📄 ${document.filename}`,
        `⚠️ Erreur de chargement: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
        `💡 Affichage de segments de démonstration`,
        `Segment 1: Contenu juridique`,
        `Segment 2: Analyse des clauses`,
        `Segment 3: Références`,
        `Segment 4: Conclusion`,
      ];
      setSegments(fallbackSegments);
      setSegmentError(`Erreur: ${error instanceof Error ? error.message : "Inconnue"}`);
      if (error instanceof Error && error.name === "AbortError") {
        showNotice("Le chargement des segments a expiré", "error");
      } else {
        showNotice("Erreur de chargement, affichage de démonstration", "info");
      }
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
        setSegmentError(null);
      }
      showNotice("Document supprimé", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de suppression";
      showNotice(message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      showNotice("Identifiant copié", "success");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = id;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      showNotice("Identifiant copié", "success");
    }
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
          item.id === account.id ? { ...item, emailVerified: !account.emailVerified } : item,
        ),
      );
      showNotice("Statut email mis à jour", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de modification";
      showNotice(message, "error");
    } finally {
      setUpdatingAccountId(null);
    }
  };

  const deleteAccount = async (account: AccountItem) => {
    const confirmed = window.confirm(
      `Supprimer le compte "${account.email}" ? Ses conversations seront détachées.`,
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
      showNotice("Compte supprimé", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de suppression";
      showNotice(message, "error");
    } finally {
      setDeletingAccountId(null);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query, filter]);
  const handleLogout = async () => {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/login")
          },
        },
      })
    }
  return (
    <main className="min-h-screen bg-background text-foreground">
      {notice && (
        <div
          className={cn(
            "fixed right-4 top-4 z-50 flex max-w-sm animate-fadeUp items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-sm shadow-lg",
            notice.type === "success"
              ? "border-primary/25 text-foreground"
              : notice.type === "info"
              ? "border-blue-500/25 text-blue-600"
              : "border-destructive/25 text-destructive",
          )}
          role="alert"
          aria-live="polite"
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : notice.type === "info" ? (
            <AlertCircle className="size-4 text-blue-500" />
          ) : (
            <AlertCircle className="size-4" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {/* En-tête avec logos */}
        <div className="flex flex-col gap-3 animate-fadeUp sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-primary/10 p-1.5">
                <Image
                  src="/silkbot-logo.png"
                  alt="SilkBot Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="relative h-6 w-auto">
                <Image
                  src="/silkbot-black.png"
                  alt="SilkBot"
                  width={80}
                  height={24}
                  className="object-contain dark:hidden"
                  priority
                />
                <Image
                  src="/silkbot-white.png"
                  alt="SilkBot"
                  width={80}
                  height={24}
                  className="hidden object-contain dark:block"
                  priority
                />
              </div>
            </div>
            <Button onClick={handleLogout}>deconnexion</Button>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Administration
              </p>
              <h1 className="font-serif text-3xl font-semibold tracking-normal">
                Base documentaire
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Pilotez les sources juridiques indexées pour SilkBot.
              </p>
            </div>
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

        {/* Statistiques */}
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
              <CardTitle>Emails vérifiés</CardTitle>
              <CardDescription>Comptes confirmés</CardDescription>
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
                  Taille max : {formatFileSize(MAX_FILE_SIZE)}.
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
                  aria-label="Zone de dépôt de fichier"
                  aria-disabled={uploading}
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
                    aria-label="Sélectionner un fichier"
                  />
                  <Upload className="size-12 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {uploading && uploadingFileName
                        ? `Indexation de "${uploadingFileName}"...`
                        : "Déposez un fichier ici ou cliquez pour parcourir"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Formats acceptés : PDF, TXT, MD — {formatFileSize(MAX_FILE_SIZE)} max
                    </p>
                  </div>
                  {uploading && (
                    <div className="mt-2 w-full max-w-md">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{uploadProgress}%</span>
                        <span>{selectedFileSize}</span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </button>
              </CardContent>
            </Card>

            <Card className="animate-fadeUp">
              <CardHeader>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Documents indexés</CardTitle>
                    <CardDescription>
                      {filteredDocuments.length} document(s) trouvé(s)
                      {!showAllDocuments &&
                        filteredDocuments.length > ITEMS_PER_PAGE &&
                        ` — Page ${currentPage}/${totalPages}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {showAllDocuments 
                        ? "Tous affichés" 
                        : `${Math.min(ITEMS_PER_PAGE, filteredDocuments.length)}/${filteredDocuments.length} affichés`}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllDocuments(!showAllDocuments)}
                      className="text-xs"
                    >
                      {showAllDocuments ? "📄 Paginer" : "📋 Afficher tout"}
                    </Button>
                  </div>
                </div>
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
                      aria-label="Rechercher un document"
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
                  <div className="hidden grid-cols-[1fr_100px_80px_100px_44px] border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                    <span>Source</span>
                    <span className="text-center">Segments</span>
                    <span className="text-center">Taille</span>
                    <span className="text-center">Date</span>
                    <span />
                  </div>

                  {loading ? (
                    <div className="space-y-2 p-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : paginatedDocuments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                      <FileText className="size-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Aucun document trouvé</p>
                      <p className="text-xs text-muted-foreground">
                        Modifiez la recherche ou importez une nouvelle source.
                      </p>
                    </div>
                  ) : (
                    <>
                      {paginatedDocuments.map((document, index) => {
                        const Icon = getFileIcon(document.filename);
                        return (
                          <div
                            key={document.id}
                            className={cn(
                              "grid gap-3 px-3 py-3 transition-colors hover:bg-muted/30 md:grid-cols-[1fr_100px_80px_100px_44px] md:items-center",
                              index !== paginatedDocuments.length - 1 && "border-b",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => loadSegments(document)}
                              className="group relative flex min-w-0 items-center gap-3 text-left"
                              aria-label={`Voir les segments de ${document.filename}`}
                            >
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                <Icon
                                  className={cn("size-4", getFileColor(document.filename))}
                                />
                              </div>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {document.filename}
                                </span>
                                <span className="flex items-center gap-2">
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {document.id.slice(0, 8)}...
                                  </span>
                                  {document.status && getStatusBadge(document.status)}
                                </span>
                                <div className="absolute left-0 top-full z-50 mt-1 hidden w-64 rounded-lg border bg-popover p-3 text-xs shadow-lg group-hover:block">
                                  <p><strong>ID :</strong> {document.id}</p>
                                  <p><strong>Nom :</strong> {document.filename}</p>
                                  <p><strong>Segments :</strong> {document.segmentCount}</p>
                                  {document.fileSize && (
                                    <p><strong>Taille :</strong> {formatFileSize(document.fileSize)}</p>
                                  )}
                                  <p><strong>Importé :</strong> {formatDate(document.createdAt)}</p>
                                </div>
                              </span>
                            </button>

                            <span className="w-fit rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary md:mx-auto">
                              {document.segmentCount}
                            </span>

                            <span className="text-xs text-muted-foreground md:text-center">
                              {document.fileSize ? formatFileSize(document.fileSize) : "—"}
                            </span>

                            <span className="text-xs text-muted-foreground md:text-center">
                              {formatDate(document.createdAt)}
                            </span>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="justify-self-end"
                                  aria-label="Menu du document"
                                >
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
                        );
                      })}

                      {!showAllDocuments && filteredDocuments.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-center border-t px-3 py-4">
                          <Button
                            variant="outline"
                            onClick={() => setShowAllDocuments(true)}
                            className="w-full max-w-sm"
                          >
                            📋 Afficher tous les {filteredDocuments.length} documents
                          </Button>
                        </div>
                      )}

                      {showAllDocuments && filteredDocuments.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-between border-t px-3 py-3">
                          <span className="text-xs text-muted-foreground">
                            {filteredDocuments.length} document(s) au total
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllDocuments(false)}
                            className="text-xs"
                          >
                            📄 Paginer
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="animate-fadeUp lg:sticky lg:top-6 lg:self-start">
            <CardHeader>
              <CardTitle>Aperçu des segments</CardTitle>
              <CardDescription>
                {selectedDocument 
                  ? `${segments.length} segment${segments.length > 1 ? "s" : ""} trouvé${segments.length > 1 ? "s" : ""}`
                  : "Contrôle rapide du contenu indexé."}
              </CardDescription>
              {selectedDocument && (
                <CardAction>
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
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {!selectedDocument ? (
                <div className="flex min-h-72 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
                  <Eye className="size-12 text-muted-foreground" />
                  <p className="text-sm font-medium">Sélectionnez un document</p>
                  <p className="max-w-56 text-xs text-muted-foreground">
                    Les premiers segments apparaissent ici pour vérification.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        {(() => {
                          const Icon = getFileIcon(selectedDocument.filename);
                          return (
                            <Icon
                              className={cn("size-5", getFileColor(selectedDocument.filename))}
                            />
                          );
                        })()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {selectedDocument.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedDocument.segmentCount} segments
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 border-t pt-2 text-xs text-muted-foreground">
                      <span>ID : {selectedDocument.id.slice(0, 12)}...</span>
                      <span>Segments : {selectedDocument.segmentCount}</span>
                      {selectedDocument.fileSize && (
                        <span>Taille : {formatFileSize(selectedDocument.fileSize)}</span>
                      )}
                      <span>Importé : {formatDate(selectedDocument.createdAt)}</span>
                    </div>
                  </div>

                  {segmentError && (
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-600">
                      ⚠️ {segmentError}
                    </div>
                  )}

                  {segmentsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton key={index} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : segments.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="size-8 text-muted-foreground" />
                        <p>Aucun segment disponible</p>
                        <p className="text-xs text-muted-foreground">
                          Ce document n&apos;a pas encore été indexé.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadSegments(selectedDocument)}
                          className="mt-2"
                        >
                          <RefreshCw className="size-3 mr-1" />
                          Réessayer
                        </Button>
                      </div>
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
                          <p className="line-clamp-5 text-muted-foreground">{segment}</p>
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
                  aria-label="Rechercher un compte"
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

              {accountsLoading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                  <Users className="size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Aucun compte trouvé</p>
                  <p className="text-xs text-muted-foreground">Essayez une autre recherche.</p>
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
                      {account.image ? (
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-full">
                          <Image
                            src={account.image}
                            alt={account.name}
                            width={40}
                            height={40}
                            className="object-cover"
                            unoptimized={account.image?.includes("googleusercontent")}
                          />
                        </div>
                      ) : (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                          {account.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2) || "?"}
                        </span>
                      )}
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
                      {account.emailVerified ? "Vérifié" : "Non vérifié"}
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
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="justify-self-end"
                          aria-label={`Menu du compte ${account.email}`}
                        >
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
                          {account.emailVerified ? "Marquer non vérifié" : "Vérifier email"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={account.isCurrentUser || deletingAccountId === account.id}
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
          Conseil : gardez les documents courts et bien structurés pour améliorer la qualité
          des réponses. Taille du dernier fichier sélectionné affichée pendant l&apos;import :{" "}
          {selectedFileSize}
        </div>
      </section>
    </main>
  );
}