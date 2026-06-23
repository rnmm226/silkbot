"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  User,
  Upload,
  Shield,
  Settings,
  AlertCircle,
  X,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  type Notification,
} from "@/lib/api/admin";

const typeColors = {
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    icon: "bg-blue-500/10 text-blue-500",
  },
  success: {
    bg: "bg-green-50 dark:bg-green-950/30",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
    icon: "bg-green-500/10 text-green-500",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    icon: "bg-amber-500/10 text-amber-500",
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    icon: "bg-red-500/10 text-red-500",
  },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const loadNotifications = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Erreur de chargement des notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(() => {
      loadNotifications(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Erreur lors du marquage:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
    } catch (error) {
      console.error("Erreur lors du marquage tout:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
    }
  };

  const handleDeleteAll = async () => {
    if (notifications.length === 0) return;
    if (!confirm("Supprimer toutes les notifications ?")) return;
    
    try {
      await Promise.all(notifications.map(n => deleteNotification(n.id)));
      setNotifications([]);
    } catch (error) {
      console.error("Erreur lors de la suppression tout:", error);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "read") return n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

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
        <div className="flex-1">
          <Card className="p-0 overflow-hidden">
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-4">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48 mt-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
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
            <Bell className="w-5 h-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
              <p className="text-xs text-muted-foreground">
                {unreadCount} non lue(s) · {notifications.length} au total
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadNotifications(true)}
            disabled={refreshing}
            className="h-8 text-xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
            Actualiser
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
              className="h-8 text-xs"
            >
              Toutes
            </Button>
            <Button
              variant={filter === "unread" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("unread")}
              className="h-8 text-xs"
            >
              <Clock className="w-3 h-3 mr-1" />
              Non lues
            </Button>
            <Button
              variant={filter === "read" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("read")}
              className="h-8 text-xs"
            >
              <Check className="w-3 h-3 mr-1" />
              Lues
            </Button>
          </div>
          {notifications.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={unreadCount === 0}
                className="h-8 text-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Tout marquer lu
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteAll}
                className="h-8 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Tout supprimer
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Liste des notifications */}
      <div className="flex-1 overflow-y-auto">
        <Card className="p-0 overflow-hidden">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Bell className="size-10 text-muted-foreground" />
              <p className="text-sm font-medium">Aucune notification</p>
              <p className="text-xs text-muted-foreground">
                {filter === "all" 
                  ? "Vous n'avez pas encore de notifications" 
                  : filter === "unread" 
                    ? "Toutes vos notifications sont lues" 
                    : "Aucune notification lue"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((notification) => {
                const Icon = notification.icon;
                const colors = typeColors[notification.type];
                
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-3 p-4 transition-colors hover:bg-muted/30 group",
                      !notification.read && "bg-muted/10"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      colors.icon
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={cn(
                            "text-sm",
                            !notification.read ? "font-semibold text-foreground" : "text-foreground"
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {notification.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {notification.time}
                          </span>
                          {!notification.read && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary text-primary-foreground">
                              Nouveau
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(notification.id)}
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}