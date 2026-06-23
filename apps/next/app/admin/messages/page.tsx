"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Mail,
  Send,
  Paperclip,
  Star,
  StarOff,
  Trash2,
  Archive,
  Reply,
  Forward,
  RefreshCw,
  Clock,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  fetchMessages,
  markMessageAsRead,
  toggleMessageStar,
  deleteMessage,
  sendMessage,
  type Message,
} from "@/lib/api/admin";

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "starred">("all");
  const [view, setView] = useState<"list" | "details">("list");
  const [replyContent, setReplyContent] = useState("");

  const loadMessages = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const data = await fetchMessages();
      setMessages(data);
    } catch (error) {
      console.error("Erreur de chargement des messages:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
    
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(() => {
      loadMessages(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [loadMessages]);

  const filteredMessages = messages.filter((msg) => {
    const matchesSearch =
      msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.preview.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      (filter === "unread" && !msg.read) ||
      (filter === "starred" && msg.starred);

    return matchesSearch && matchesFilter;
  });

  const handleToggleStar = async (id: string) => {
    try {
      await toggleMessageStar(id);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === id ? { ...msg, starred: !msg.starred } : msg
        )
      );
    } catch (error) {
      console.error("Erreur lors du toggle star:", error);
    }
  };

  const handleSelectMessage = async (id: string) => {
    setSelectedId(id);
    setView("details");
    
    const message = messages.find((m) => m.id === id);
    if (message && !message.read) {
      try {
        await markMessageAsRead(id);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === id ? { ...msg, read: true } : msg
          )
        );
      } catch (error) {
        console.error("Erreur lors du marquage lu:", error);
      }
    }
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      await deleteMessage(id);
      setMessages((prev) => prev.filter((msg) => msg.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setView("list");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyContent.trim()) return;

    try {
      await sendMessage(
        selectedMessage.fromEmail,
        `Re: ${selectedMessage.subject}`,
        replyContent
      );
      setReplyContent("");
      // Optionnel: ajouter le message envoyé dans la liste
    } catch (error) {
      console.error("Erreur lors de l'envoi:", error);
    }
  };

  const selectedMessage = messages.find((m) => m.id === selectedId);
  const unreadCount = messages.filter((m) => !m.read).length;

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)]">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-5 h-5 rounded" />
            <div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-3 w-48 mt-1" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="flex flex-1 gap-4 overflow-hidden">
          <div className="flex-1">
            <Card className="p-0 overflow-hidden">
              <div className="p-3 border-b">
                <Skeleton className="h-8 w-full" />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border-b">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48 mt-1" />
                    <Skeleton className="h-3 w-40 mt-1" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Header avec stats */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Messages</h2>
              <p className="text-xs text-muted-foreground">
                {unreadCount} non lu(s) · {messages.length} au total
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMessages(true)}
            disabled={refreshing}
            className="h-8 text-xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
            Actualiser
          </Button>
          <Button size="sm" className="h-8 text-xs">
            <Mail className="w-3.5 h-3.5 mr-1.5" />
            Nouveau
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Liste des messages */}
        <div className={cn(
          "flex-1 overflow-y-auto",
          view === "details" && "hidden lg:block"
        )}>
          <Card className="p-0 overflow-hidden">
            {/* Barre de recherche et filtres */}
            <div className="flex items-center gap-2 p-3 border-b">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher dans les messages..."
                  className="pl-8 h-8 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant={filter === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("all")}
                  className="h-8 text-xs"
                >
                  Tous
                </Button>
                <Button
                  variant={filter === "unread" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("unread")}
                  className="h-8 text-xs"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Non lus
                </Button>
                <Button
                  variant={filter === "starred" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("starred")}
                  className="h-8 text-xs"
                >
                  <Star className="w-3 h-3 mr-1" />
                  Favoris
                </Button>
              </div>
            </div>

            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Mail className="size-10 text-muted-foreground" />
                <p className="text-sm font-medium">Aucun message</p>
                <p className="text-xs text-muted-foreground">
                  Aucun message ne correspond à vos critères
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 border-b cursor-pointer transition-colors hover:bg-muted/30 group",
                    selectedId === msg.id && "bg-primary/5",
                    !msg.read && "bg-muted/10"
                  )}
                >
                  <Avatar className="w-10 h-10 mt-0.5">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {msg.from.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "text-sm truncate",
                        !msg.read ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}>
                        {msg.from}
                      </p>
                      {!msg.read && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                          Nouveau
                        </Badge>
                      )}
                      {msg.labels.map((label) => (
                        <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                          {label}
                        </Badge>
                      ))}
                    </div>
                    <p className={cn(
                      "text-sm truncate",
                      !msg.read ? "font-medium text-foreground" : "text-muted-foreground"
                    )}>
                      {msg.subject}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {msg.preview}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {msg.date}
                    </span>
                    <div className="flex items-center gap-1">
                      {msg.hasAttachment && (
                        <Paperclip className="w-3 h-3 text-muted-foreground" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStar(msg.id);
                        }}
                        className="p-0.5 hover:bg-muted rounded transition-colors"
                      >
                        {msg.starred ? (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        ) : (
                          <StarOff className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        {/* Détails du message */}
        {selectedMessage && (
          <div className={cn(
            "w-full lg:w-[500px] flex-shrink-0 overflow-y-auto",
            view === "list" && "hidden lg:block"
          )}>
            <Card className="p-0 h-full flex flex-col">
              {/* En-tête des détails */}
              <div className="flex items-center justify-between p-3 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setView("list")}
                >
                  <X className="w-4 h-4 mr-1" />
                  Retour
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleToggleStar(selectedMessage.id)}
                  >
                    {selectedMessage.starred ? (
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    ) : (
                      <StarOff className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon-sm">
                    <Reply className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm">
                    <Forward className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm">
                    <Archive className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteMessage(selectedMessage.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Contenu du message */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {selectedMessage.from.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {selectedMessage.from}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedMessage.fromEmail}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedMessage.date}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {selectedMessage.subject}
                  </h3>
                </div>

                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p>{selectedMessage.preview}</p>
                  <p className="mt-2">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                    incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                    nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                  </p>
                  <p className="mt-2">
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
                    fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
                    culpa qui officia deserunt mollit anim id est laborum.
                  </p>
                </div>

                {selectedMessage.hasAttachment && (
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-muted">
                        <Paperclip className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">document.pdf</p>
                        <p className="text-xs text-muted-foreground">2.4 MB</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Télécharger
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Réponse */}
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Écrire une réponse..."
                    className="flex-1 text-sm"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                  />
                  <Button size="sm" onClick={handleSendReply}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}