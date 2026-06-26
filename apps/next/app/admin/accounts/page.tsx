"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Filter,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  TrendingUp,
  User as IconUser,
  UserCheck,
  UserX,
  Users,
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
import { 
  fetchAccounts as fetchAccountsApi,
  deleteAccount as deleteAccountApi,
  verifyAccount as verifyAccountApi,
  updateAccount as updateAccountApi,
  type User
} from "@/lib/api/admin";

type Notice = { message: string; type: "success" | "error" | "info" };
type FilterType = "all" | "verified" | "unverified" | "admin";

const ITEMS_PER_PAGE = 10;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-TN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatRelativeDate(date: string) {
  const now = new Date();
  const past = new Date(date);
  const diff = now.getTime() - past.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  if (days < 7) return `Il y a ${days} j`;
  return formatDate(date);
}

function StatusBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
        verified
          ? "text-green-700 bg-green-50 border border-green-200"
          : "text-yellow-700 bg-yellow-50 border border-yellow-200"
      )}
    >
      {verified ? (
        <>
          <CheckCircle2 className="size-3" />
          Vérifié
        </>
      ) : (
        <>
          <Clock className="size-3" />
          En attente
        </>
      )}
    </span>
  );
}

function RoleBadge({ role }: { role?: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-200">
        <Shield className="size-3" />
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted/50 border">
      <IconUser className="size-3" />
      Utilisateur
    </span>
  );
}

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const noticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showNotice = useCallback((message: string, type: Notice["type"]) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ message, type });
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3500);
  }, []);

  useEffect(() => () => { if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current); }, []);

  const loadAccounts = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      try {
        const data = await fetchAccountsApi();
        setAccounts(data);
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

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchesQuery =
        acc.email.toLowerCase().includes(query.toLowerCase()) ||
        (acc.name?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
        acc.id.toLowerCase().includes(query.toLowerCase());
      
      const matchesFilter =
        filter === "all" ||
        (filter === "verified" && acc.emailVerified) ||
        (filter === "unverified" && !acc.emailVerified) ||
        (filter === "admin" && acc.role === "admin");
      
      return matchesQuery && matchesFilter;
    });
  }, [accounts, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE));

  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAccounts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAccounts, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [query, filter]);

  const handleDeleteAccount = async (account: User) => {
    if (!confirm(`Supprimer le compte "${account.email}" ? Cette action est irréversible.`)) return;
    setDeletingId(account.id);
    try {
      await deleteAccountApi(account.id);
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      if (selectedAccount?.id === account.id) {
        setSelectedAccount(null);
      }
      showNotice("Compte supprimé avec succès", "success");
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Erreur de suppression", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleVerifyAccount = async (account: User) => {
    try {
      const updated = await verifyAccountApi(account.id);
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, emailVerified: true } : a))
      );
      if (selectedAccount?.id === account.id) {
        setSelectedAccount((prev) => prev ? { ...prev, emailVerified: true } : null);
      }
      showNotice(`Email vérifié pour ${account.email}`, "success");
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Erreur de vérification", "error");
    }
  };

  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email).catch(() => {});
    showNotice("Email copié", "success");
  };

  const copyId = async (id: string) => {
    await navigator.clipboard.writeText(id).catch(() => {});
    showNotice("Identifiant copié", "success");
  };

  const stats = useMemo(() => ({
    total: accounts.length,
    verified: accounts.filter(a => a.emailVerified).length,
    unverified: accounts.filter(a => !a.emailVerified).length,
    admins: accounts.filter(a => a.role === "admin").length,
  }), [accounts]);

  const closeDetails = useCallback(() => {
    setSelectedAccount(null);
  }, []);

  const openDetails = useCallback((account: User) => {
    setSelectedAccount(account);
  }, []);

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

      <div className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-base font-medium">Comptes utilisateurs</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats.total} compte(s) · {stats.verified} vérifié(s) · {stats.admins} admin(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAccounts(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className={cn(
          "flex flex-1 flex-col gap-5 overflow-y-auto p-6 transition-all duration-300",
          selectedAccount ? "xl:pr-2" : ""
        )}>
          {/* Statistiques - Style identique à la page d'accueil */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { 
                title: "Total", 
                value: stats.total, 
                increase: `${stats.total} utilisateur(s)`,
                bgColor: "bg-primary",
                textColor: "text-primary-foreground",
                icon: Users,
                delay: "0ms",
              },
              { 
                title: "Vérifiés", 
                value: stats.verified,
                increase: `${Math.round((stats.verified / (stats.total || 1)) * 100)}% du total`,
                bgColor: "bg-card",
                textColor: "text-foreground",
                icon: UserCheck,
                delay: "100ms",
              },
              { 
                title: "En attente", 
                value: stats.unverified,
                subtitle: stats.unverified > 0 ? `${stats.unverified} à vérifier` : "Tout vérifié",
                bgColor: "bg-card",
                textColor: "text-foreground",
                icon: UserX,
                delay: "200ms",
              },
              { 
                title: "Administrateurs", 
                value: stats.admins,
                subtitle: stats.admins > 0 ? `${stats.admins} admin(s)` : "Aucun admin",
                bgColor: "bg-card",
                textColor: "text-foreground",
                icon: Shield,
                delay: "300ms",
              },
            ].map((stat, index) => {
              const Icon = stat.icon;
              const isPrimary = index === 0;
              
              return (
                <Card
                  key={stat.title}
                  onMouseEnter={() => setHoveredCard(index)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{ animationDelay: stat.delay }}
                  className={cn(
                    "p-4 transition-all duration-500 ease-out animate-slide-in-up cursor-pointer",
                    isPrimary ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
                    hoveredCard === index ? "scale-105 shadow-2xl" : "shadow-lg"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xs font-medium opacity-90">{stat.title}</h3>
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300",
                        isPrimary ? "bg-primary-foreground/20" : "bg-primary",
                        hoveredCard === index ? "rotate-45" : ""
                      )}
                    >
                      <Icon className={cn(
                        "w-3 h-3",
                        isPrimary ? "text-primary-foreground" : "text-primary-foreground"
                      )} />
                    </div>
                  </div>
                  <p className="text-3xl font-bold mb-2">{stat.value}</p>
                  <div className="flex items-center gap-1.5 text-xs opacity-80">
                    {stat.increase && (
                      <>
                        <TrendingUp className="w-3 h-3" />
                        <span>{stat.increase}</span>
                      </>
                    )}
                    {stat.subtitle && <span>{stat.subtitle}</span>}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tous les comptes</CardTitle>
              <CardDescription className="text-xs">
                {filteredAccounts.length} compte(s) · page {currentPage}/{totalPages}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher par email, nom ou identifiant…"
                    className="pl-8 text-sm"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="shrink-0">
                      <Filter className="size-3.5 mr-1" />
                      {filter === "all" ? "Tous" : 
                       filter === "verified" ? "Vérifiés" :
                       filter === "unverified" ? "En attente" : "Admins"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuLabel className="text-xs">Filtre</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFilter("all")}>Tous</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilter("verified")}>Vérifiés</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilter("unverified")}>En attente</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilter("admin")}>Administrateurs</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="hidden grid-cols-[1fr_100px_90px_100px_36px] border-b bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Utilisateur</span>
                  <span className="text-center">Statut</span>
                  <span className="text-center">Rôle</span>
                  <span className="text-center">Inscrit</span>
                  <span />
                </div>

                {loading ? (
                  <div className="space-y-1.5 p-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : paginatedAccounts.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 p-8 text-center">
                    <Users className="size-7 text-muted-foreground" />
                    <p className="text-sm font-medium">Aucun compte trouvé</p>
                    <p className="text-xs text-muted-foreground">
                      Modifiez la recherche ou les filtres.
                    </p>
                  </div>
                ) : (
                  paginatedAccounts.map((acc, idx) => (
                    <div
                      key={acc.id}
                      className={cn(
                        "grid gap-2 px-3 py-2.5 transition-colors hover:bg-muted/20 md:grid-cols-[1fr_100px_90px_100px_36px] md:items-center",
                        idx !== paginatedAccounts.length - 1 && "border-b",
                        selectedAccount?.id === acc.id && "bg-primary/5"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => openDetails(acc)}
                        className="flex min-w-0 items-center gap-2.5 text-left"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <IconUser className="size-4 text-primary" />
                        </div>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {acc.name || "Sans nom"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="block text-xs text-muted-foreground">
                              {acc.email}
                            </span>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-muted-foreground">
                              {acc.id.slice(0, 8)}…
                            </span>
                          </span>
                        </span>
                      </button>

                      <div className="flex justify-center">
                        <StatusBadge verified={acc.emailVerified} />
                      </div>

                      <div className="flex justify-center">
                        <RoleBadge role={acc.role} />
                      </div>

                      <span className="text-xs text-muted-foreground text-center">
                        {formatDate(acc.createdAt)}
                      </span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Options">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => openDetails(acc)}>
                            <Eye className="size-4 mr-2" /> Voir les détails
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyEmail(acc.email)}>
                            <Mail className="size-4 mr-2" /> Copier l'email
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyId(acc.id)}>
                            <Copy className="size-4 mr-2" /> Copier l'identifiant
                          </DropdownMenuItem>
                          {!acc.emailVerified && (
                            <DropdownMenuItem onClick={() => void handleVerifyAccount(acc)}>
                              <CheckCircle2 className="size-4 mr-2" /> Vérifier l'email
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={deletingId === acc.id}
                            onClick={() => void handleDeleteAccount(acc)}
                          >
                            <Trash2 className="size-4 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </div>

              {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span>
                    {filteredAccounts.length} compte(s) · page {currentPage}/{totalPages}
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

        {selectedAccount && (
          <aside className="w-80 flex-shrink-0 border-l animate-in slide-in-from-right duration-300 xl:flex xl:flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-medium">Détails du compte</p>
                <p className="text-xs text-muted-foreground">
                  Informations utilisateur
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={closeDetails}
                aria-label="Fermer les détails"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/20 p-4">
                  <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                    <IconUser className="size-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{selectedAccount.name || "Sans nom"}</p>
                  <p className="text-xs text-muted-foreground">{selectedAccount.email}</p>
                  <div className="flex gap-2">
                    <StatusBadge verified={selectedAccount.emailVerified} />
                    <RoleBadge role={selectedAccount.role} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Informations
                  </h4>
                  <div className="rounded-lg border divide-y">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-muted-foreground">ID</span>
                      <span className="text-xs font-mono">{selectedAccount.id}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-muted-foreground">Inscrit le</span>
                      <span className="text-xs">{formatDate(selectedAccount.createdAt)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-muted-foreground">Statut email</span>
                      <span className="text-xs">
                        {selectedAccount.emailVerified ? (
                          <span className="text-green-600">✓ Vérifié</span>
                        ) : (
                          <span className="text-yellow-600">⏳ En attente</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-muted-foreground">Chats</span>
                      <span className="text-xs">{selectedAccount.chatCount}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-muted-foreground">Sessions</span>
                      <span className="text-xs">{selectedAccount.sessionCount}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </h4>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => copyEmail(selectedAccount.email)}
                    >
                      <Mail className="size-4 mr-2" />
                      Copier l'email
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => copyId(selectedAccount.id)}
                    >
                      <Copy className="size-4 mr-2" />
                      Copier l'identifiant
                    </Button>
                    {!selectedAccount.emailVerified && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-green-600"
                        onClick={() => void handleVerifyAccount(selectedAccount)}
                      >
                        <CheckCircle2 className="size-4 mr-2" />
                        Vérifier l'email
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full justify-start"
                      disabled={deletingId === selectedAccount.id}
                      onClick={() => void handleDeleteAccount(selectedAccount)}
                    >
                      <Trash2 className="size-4 mr-2" />
                      Supprimer le compte
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}