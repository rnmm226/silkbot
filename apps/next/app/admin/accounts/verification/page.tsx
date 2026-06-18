"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Mail,
  RefreshCw,
  Search,
  User,
  UserCheck,
  Users,
  XCircle,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AccountItem = {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  name?: string;
};

type Notice = { message: string; type: "success" | "error" | "info" };

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-TN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function AdminVerificationPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const showNotice = useCallback((message: string, type: Notice["type"]) => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 3500);
  }, []);

  const fetchAccounts = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      try {
        const res = await fetch("/api/admin/accounts");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
        setAccounts(Array.isArray(data) ? data : data.accounts ?? []);
      } catch (err) {
        showNotice(err instanceof Error ? err.message : "Erreur de chargement", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showNotice],
  );

  useEffect(() => { void fetchAccounts(); }, [fetchAccounts]);

  const unverifiedAccounts = accounts
    .filter((acc) => !acc.emailVerified)
    .filter((acc) => 
      acc.email.toLowerCase().includes(query.toLowerCase()) ||
      (acc.name?.toLowerCase().includes(query.toLowerCase()) ?? false)
    );

  const verifyAccount = async (account: AccountItem) => {
    setVerifyingId(account.id);
    try {
      const res = await fetch("/api/admin/accounts/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Vérification impossible");
      
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, emailVerified: true } : a))
      );
      showNotice(`Email vérifié pour ${account.email}`, "success");
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Erreur de vérification", "error");
    } finally {
      setVerifyingId(null);
    }
  };

  const stats = {
    total: accounts.length,
    verified: accounts.filter(a => a.emailVerified).length,
    unverified: accounts.filter(a => !a.emailVerified).length,
  };

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
          {notice.type === "success" ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <XCircle className="size-4" />
          )}
          {notice.message}
        </div>
      )}

      {/* En-tête */}
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-base font-medium">Vérification des comptes</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats.unverified} compte(s) en attente de vérification
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAccounts(true)}
          disabled={refreshing}
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          Actualiser
        </Button>
      </header>

      <div className="flex flex-col gap-5 p-6">
        {/* Statistiques */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Total", value: stats.total, icon: Users, color: "text-blue-500" },
            { label: "Vérifiés", value: stats.verified, icon: UserCheck, color: "text-green-500" },
            { label: "En attente", value: stats.unverified, icon: Clock, color: "text-yellow-500" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3"
            >
              <div className={cn("flex size-8 items-center justify-center rounded-md bg-background border", stat.color)}>
                <stat.icon className="size-4" />
              </div>
              <div>
                <p className="text-lg font-medium">{stat.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Liste des comptes à vérifier */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Comptes en attente</CardTitle>
            <CardDescription className="text-xs">
              {unverifiedAccounts.length} compte(s) à vérifier
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher par email ou nom…"
                className="pl-8 text-sm"
              />
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="hidden grid-cols-[1fr_auto_150px] border-b bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
                <span>Utilisateur</span>
                <span>Inscrit le</span>
                <span className="text-right">Action</span>
              </div>

              {loading ? (
                <div className="space-y-1.5 p-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : unverifiedAccounts.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 p-8 text-center">
                  <UserCheck className="size-7 text-green-500" />
                  <p className="text-sm font-medium">Tous les comptes sont vérifiés</p>
                  <p className="text-xs text-muted-foreground">
                    Aucun compte en attente de vérification.
                  </p>
                </div>
              ) : (
                unverifiedAccounts.map((acc, idx) => (
                  <div
                    key={acc.id}
                    className={cn(
                      "grid gap-2 px-3 py-2.5 transition-colors hover:bg-muted/20 md:grid-cols-[1fr_auto_150px] md:items-center",
                      idx !== unverifiedAccounts.length - 1 && "border-b",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                        <User className="size-4 text-yellow-600" />
                      </div>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {acc.name || "Sans nom"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-xs text-muted-foreground">
                            {acc.email}
                          </span>
                          <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 text-[10px]">
                            <Clock className="size-3 mr-1" />
                            En attente
                          </Badge>
                        </span>
                      </span>
                    </div>

                    <span className="text-xs text-muted-foreground">
                      {formatDate(acc.createdAt)}
                    </span>

                    <Button
                      size="sm"
                      className="w-full"
                      disabled={verifyingId === acc.id}
                      onClick={() => void verifyAccount(acc)}
                    >
                      {verifyingId === acc.id ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5" />
                          Vérifier
                        </>
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}