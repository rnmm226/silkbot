"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Database,
  FileText,
  RefreshCw,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DocumentItem = {
  id: string;
  filename: string;
  segmentCount: number;
  createdAt: string;
  fileSize?: number;
};

type AccountItem = {
  id: string;
  emailVerified: boolean;
  createdAt: string;
};

type Notice = { message: string; type: "success" | "error" | "info" };

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

export default function AdminOverviewPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const showNotice = useCallback((message: string, type: Notice["type"]) => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 3500);
  }, []);

  const fetchData = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      try {
        const [docsRes, accountsRes] = await Promise.all([
          fetch("/api/admin/document-ref"),
          fetch("/api/admin/accounts"),
        ]);
        const [docsData, accountsData] = await Promise.all([
          docsRes.json(),
          accountsRes.json(),
        ]);
        setDocuments(Array.isArray(docsData) ? docsData : docsData.documents ?? []);
        setAccounts(Array.isArray(accountsData) ? accountsData : accountsData.accounts ?? []);
      } catch {
        showNotice("Erreur lors du chargement des données", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showNotice],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const totalSegments = useMemo(
    () => documents.reduce((sum, d) => sum + d.segmentCount, 0),
    [documents],
  );

  const verifiedCount = useMemo(
    () => accounts.filter((a) => a.emailVerified).length,
    [accounts],
  );

  const recentDocuments = useMemo(() => documents.slice(0, 5), [documents]);

  const stats = [
    {
      label: "Documents",
      value: documents.length,
      sub: "Sources indexées",
      icon: FileText,
      delay: "0ms",
    },
    {
      label: "Segments",
      value: totalSegments.toLocaleString("fr-FR"),
      sub: "Passages consultables",
      icon: Database,
      delay: "60ms",
    },
    {
      label: "Utilisateurs",
      value: accounts.length,
      sub: "Comptes inscrits",
      icon: Users,
      delay: "120ms",
    },
    {
      label: "Emails vérifiés",
      value: verifiedCount,
      sub: "Comptes confirmés",
      icon: ShieldCheck,
      delay: "180ms",
    },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {notice && (
        <div
          role="alert"
          aria-live="polite"
          className={cn(
            "fixed right-4 top-4 z-50 flex max-w-sm items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-sm shadow-lg",
            notice.type === "error"
              ? "border-destructive/25 text-destructive"
              : "border-primary/25 text-foreground",
          )}
        >
          {notice.message}
        </div>
      )}

      {/* En-tête */}
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-base font-medium">Vue d'ensemble</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tableau de bord administrateur · SilkBot
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
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

      <div className="flex flex-col gap-6 p-6">
        {/* Statistiques */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="animate-fadeUp rounded-lg border bg-muted/30 p-4"
              style={{ animationDelay: stat.delay }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </p>
                <stat.icon className="size-4 text-muted-foreground" />
              </div>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <>
                  <p className="text-2xl font-medium">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Imports récents */}
          <Card className="animate-fadeUp">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Imports récents</CardTitle>
                  <CardDescription className="text-xs">
                    Les 5 derniers documents indexés
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
                  <Link href="/admin/documents">
                    Tous les documents
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : recentDocuments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucun document importé
                </p>
              ) : (
                <div className="divide-y">
                  {recentDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.segmentCount} segments
                          {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="size-3" />
                        {formatDate(doc.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Accès rapide */}
          <Card className="animate-fadeUp [animation-delay:60ms]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Actions rapides</CardTitle>
              <CardDescription className="text-xs">
                Raccourcis vers les opérations courantes
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 pt-0">
              {[
                {
                  href: "/admin/documents/upload",
                  icon: Upload,
                  label: "Importer un document",
                  sub: "PDF, TXT ou Markdown",
                },
                {
                  href: "/admin/documents",
                  icon: FileText,
                  label: "Gérer les documents",
                  sub: `${documents.length} source(s) indexée(s)`,
                },
                {
                  href: "/admin/accounts",
                  icon: Users,
                  label: "Gérer les comptes",
                  sub: `${accounts.length} utilisateur(s) inscrit(s)`,
                },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                    <action.icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.sub}</p>
                  </div>
                  <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}