// lib/api/admin.ts

// ============ INTERFACES ============

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  accountCount: number;
  chatCount: number;
  sessionCount: number;
  isCurrentUser: boolean;
  role?: string;
}

export interface Document {
  id: string;
  filename: string;
  segmentCount: number;
  createdAt: string;
  content?: string;
}

export interface DocumentSegment {
  segments: string[];
  count: number;
  documentId: string;
}

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  description: string;
  time: string;
  read: boolean;
  icon: any;
  userId?: string;
  documentId?: string;
  timestamp: number;
}

export interface Message {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  date: string;
  read: boolean;
  starred: boolean;
  hasAttachment: boolean;
  labels: string[];
  timestamp: number;
  userId?: string;
}

export interface Activity {
  id: string;
  type: "upload" | "verify" | "user" | "delete" | "update";
  title: string;
  description: string;
  time: string;
  timestamp: number;
  user?: string;
  document?: string;
}

export interface Stats {
  documents: number;
  segments: number;
  users: number;
  verificationPending: number;
  documentsTrend: string;
  segmentsTrend: string;
  usersTrend: string;
}

// ============ FONCTIONS DE FORMATAGE ============

export function formatRelativeTime(dateString: string): string {
  try {
    const now = Date.now();
    const date = new Date(dateString).getTime();
    const diff = now - date;

    if (isNaN(diff)) return "Date inconnue";

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(diff / 604800000);
    const months = Math.floor(diff / 2592000000);
    const years = Math.floor(diff / 31536000000);

    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours} h`;
    if (days < 7) return `Il y a ${days} j`;
    if (weeks < 4) return `Il y a ${weeks} sem`;
    if (months < 12) return `Il y a ${months} mois`;
    return `Il y a ${years} an${years > 1 ? 's' : ''}`;
  } catch {
    return "Date inconnue";
  }
}

function formatDate(date: string) {
  try {
    return new Intl.DateTimeFormat("fr-TN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  } catch {
    return "Date inconnue";
  }
}

// ============ FONCTIONS API DOCUMENTS ============

export async function fetchDocuments(): Promise<Document[]> {
  try {
    const res = await fetch("/api/admin/document-ref");
    
    if (!res.ok) {
      console.error(`Erreur API documents: ${res.status}`);
      return [];
    }

    const text = await res.text();
    if (!text || text.trim() === '') {
      return [];
    }

    const data = JSON.parse(text);
    return Array.isArray(data) ? data : (data.documents ?? []);
  } catch (error) {
    console.error("Erreur fetchDocuments:", error);
    return [];
  }
}

export async function fetchDocumentSegments(documentId: string): Promise<DocumentSegment> {
  try {
    const res = await fetch(`/api/admin/document-ref/${documentId}/segments`);
    
    if (!res.ok) {
      return { segments: [], count: 0, documentId };
    }

    const text = await res.text();
    if (!text || text.trim() === '') {
      return { segments: [], count: 0, documentId };
    }

    const data = JSON.parse(text);
    return {
      segments: data.segments ?? [],
      count: data.count ?? 0,
      documentId: data.documentId ?? documentId,
    };
  } catch (error) {
    console.error("Erreur fetchDocumentSegments:", error);
    return { segments: [], count: 0, documentId };
  }
}

export async function deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/document-ref", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: documentId }),
    });

    if (!res.ok) {
      const error = await res.text();
      return { success: false, error: error || "Erreur de suppression" };
    }

    const data = await res.json();
    return { success: true };
  } catch (error) {
    console.error("Erreur deleteDocument:", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

// ============ FONCTIONS API COMPTES ============

export async function fetchAccounts(): Promise<User[]> {
  try {
    const res = await fetch("/api/admin/accounts");
    
    if (!res.ok) {
      console.error(`Erreur API accounts: ${res.status}`);
      return [];
    }

    const text = await res.text();
    if (!text || text.trim() === '') {
      return [];
    }

    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Erreur fetchAccounts:", error);
    return [];
  }
}

export async function deleteAccount(userId: string): Promise<void> {
  const res = await fetch("/api/admin/accounts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: userId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erreur de suppression");
  }
}

export async function verifyAccount(userId: string): Promise<User> {
  const res = await fetch("/api/admin/accounts/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: userId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erreur de vérification");
  }
  const data = await res.json();
  return data.account;
}

export async function updateAccount(
  userId: string,
  data: { emailVerified?: boolean; name?: string }
): Promise<User> {
  const res = await fetch("/api/admin/accounts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: userId, ...data }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erreur de mise à jour");
  }
  return res.json();
}

// ============ FONCTIONS STATISTIQUES ============

export async function fetchStats(): Promise<Stats> {
  try {
    const [documents, accounts] = await Promise.all([
      fetchDocuments(),
      fetchAccounts()
    ]);

    const totalSegments = documents.reduce((acc, doc) => acc + (doc.segmentCount || 0), 0);

    const now = Date.now();
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const recentDocs = documents.filter(
      doc => new Date(doc.createdAt).getTime() > oneMonthAgo
    );

    const recentUsers = accounts.filter(
      user => new Date(user.createdAt).getTime() > oneMonthAgo
    );

    return {
      documents: documents.length,
      segments: totalSegments,
      users: accounts.length,
      verificationPending: accounts.filter(u => !u.emailVerified).length,
      documentsTrend: `+${recentDocs.length} ce mois`,
      segmentsTrend: `+${Math.floor(recentDocs.length * 4.5)} ce mois`,
      usersTrend: `+${recentUsers.length} ce mois`,
    };
  } catch (error) {
    console.error("Erreur lors du calcul des stats:", error);
    return {
      documents: 0,
      segments: 0,
      users: 0,
      verificationPending: 0,
      documentsTrend: "+0 ce mois",
      segmentsTrend: "+0 ce mois",
      usersTrend: "+0 ce mois",
    };
  }
}

// ============ FONCTIONS ACTIVITÉS ============

export async function fetchActivities(limit: number = 10): Promise<Activity[]> {
  try {
    const [documents, accounts] = await Promise.all([
      fetchDocuments(),
      fetchAccounts()
    ]);

    const activities: Activity[] = [];

    // Activités des documents (upload)
    documents.forEach((doc) => {
      activities.push({
        id: `doc-${doc.id}`,
        type: "upload",
        title: "Document importé",
        description: doc.filename,
        time: formatRelativeTime(doc.createdAt),
        timestamp: new Date(doc.createdAt).getTime(),
        document: doc.filename,
      });
    });

    // Activités des comptes (nouveaux utilisateurs)
    accounts.forEach((user) => {
      if (user.createdAt) {
        activities.push({
          id: `user-${user.id}`,
          type: "user",
          title: "Nouvel utilisateur",
          description: user.email,
          time: formatRelativeTime(user.createdAt),
          timestamp: new Date(user.createdAt).getTime(),
          user: user.email,
        });
      }
    });

    // Activités de vérification
    accounts
      .filter(user => user.emailVerified && user.updatedAt)
      .forEach((user) => {
        activities.push({
          id: `verify-${user.id}`,
          type: "verify",
          title: "Compte vérifié",
          description: user.email,
          time: formatRelativeTime(user.updatedAt),
          timestamp: new Date(user.updatedAt).getTime(),
          user: user.email,
        });
      });

    // Trier par date décroissante
    activities.sort((a, b) => b.timestamp - a.timestamp);

    return activities.slice(0, limit);
  } catch (error) {
    console.error("Erreur lors de la génération des activités:", error);
    return [];
  }
}

// ============ FONCTIONS NOTIFICATIONS ============

export async function fetchNotifications(): Promise<Notification[]> {
  try {
    const [documents, accounts] = await Promise.all([
      fetchDocuments(),
      fetchAccounts()
    ]);

    const notifications: Notification[] = [];

    // Notifications de documents (uploads récents)
    documents.slice(0, 5).forEach((doc) => {
      notifications.push({
        id: `doc-${doc.id}`,
        type: "success",
        title: "Document indexé avec succès",
        description: `${doc.filename} a été indexé avec ${doc.segmentCount} segments`,
        time: formatRelativeTime(doc.createdAt),
        read: false,
        timestamp: new Date(doc.createdAt).getTime(),
        documentId: doc.id,
        icon: getIconForType("success"),
      });
    });

    // Notifications de nouveaux utilisateurs
    accounts.filter(user => user.createdAt).slice(0, 3).forEach((user) => {
      notifications.push({
        id: `user-${user.id}`,
        type: "info",
        title: "Nouvel utilisateur inscrit",
        description: `${user.email} a rejoint la plateforme`,
        time: formatRelativeTime(user.createdAt),
        read: false,
        timestamp: new Date(user.createdAt).getTime(),
        userId: user.id,
        icon: getIconForType("info"),
      });
    });

    // Notifications de vérification en attente
    const unverifiedAccounts = accounts.filter(user => !user.emailVerified);
    if (unverifiedAccounts.length > 0) {
      notifications.push({
        id: `verify-pending-${Date.now()}`,
        type: "warning",
        title: "Vérification en attente",
        description: `${unverifiedAccounts.length} comptes utilisateurs nécessitent une vérification`,
        time: "À l'instant",
        read: false,
        timestamp: Date.now(),
        icon: getIconForType("warning"),
      });
    }

    // Notifications de comptes vérifiés récemment
    accounts
      .filter(user => user.emailVerified && user.updatedAt)
      .slice(0, 2)
      .forEach((user) => {
        notifications.push({
          id: `verify-${user.id}`,
          type: "success",
          title: "Compte vérifié",
          description: `Le compte de ${user.email} a été vérifié`,
          time: formatRelativeTime(user.updatedAt),
          read: true,
          timestamp: new Date(user.updatedAt).getTime(),
          userId: user.id,
          icon: getIconForType("success"),
        });
      });

    // Trier par date décroissante
    notifications.sort((a, b) => b.timestamp - a.timestamp);

    return notifications;
  } catch (error) {
    console.error("Erreur lors de la génération des notifications:", error);
    return [];
  }
}

// Fonction utilitaire pour obtenir l'icône selon le type
function getIconForType(type: string) {
  const icons = {
    success: "CheckCircle2",
    info: "Info",
    warning: "AlertCircle",
    error: "XCircle",
  };
  return icons[type as keyof typeof icons] || "Bell";
}

// ============ FONCTIONS MESSAGES ============

export async function fetchMessages(): Promise<Message[]> {
  try {
    const accounts = await fetchAccounts();
    const messages: Message[] = [];

    if (accounts.length === 0) {
      // Si pas de comptes, générer des messages mock
      return generateMockMessages();
    }

    // Générer des messages à partir des comptes existants
    accounts.forEach((user, index) => {
      if (user.email) {
        const topics = [
          "Mise à jour du projet",
          "Rapport hebdomadaire",
          "Réunion technique",
          "Feedback sur le design",
          "Nouveau collaborateur",
          "Questions sur l'API",
          "Validation des documents",
          "Planification de la semaine",
        ];
        const previews = [
          "Voici les dernières modifications apportées au projet...",
          "Le rapport de cette semaine est disponible...",
          "Confirmation de la réunion de demain à 14h...",
          "J'ai revu les maquettes et voici mes retours...",
          "Bienvenue à notre nouveau membre...",
          "J'ai quelques questions concernant l'utilisation de l'API...",
          "Tous les documents ont été validés...",
          "Voici le planning de la semaine prochaine...",
        ];
        const labels = [
          ["important"],
          ["work"],
          ["meeting"],
          ["design"],
          [],
          ["api"],
          ["documents"],
          ["planning"],
        ];

        const randomIndex = index % topics.length;
        const timestamp = Date.now() - (index * 3600000) - (index * 60000);

        messages.push({
          id: `msg-${user.id}`,
          from: user.name || user.email.split('@')[0],
          fromEmail: user.email,
          subject: topics[randomIndex] || "Nouveau message",
          preview: previews[randomIndex] || "Nouveau message disponible",
          date: formatRelativeTime(new Date(timestamp).toISOString()),
          read: index % 2 === 0,
          starred: index % 3 === 0,
          hasAttachment: index % 2 === 0,
          labels: labels[randomIndex] || [],
          timestamp: timestamp,
          userId: user.id,
        });
      }
    });

    // Trier par date décroissante
    messages.sort((a, b) => b.timestamp - a.timestamp);

    return messages;
  } catch (error) {
    console.error("Erreur lors de la génération des messages:", error);
    return generateMockMessages();
  }
}

// Générer des messages mock si pas de comptes
function generateMockMessages(): Message[] {
  const mockUsers = [
    { name: "Jessin Sam", email: "jessin@silkbot.com" },
    { name: "Alexandra Deff", email: "alexandra@silkbot.com" },
    { name: "Edwin Adenike", email: "edwin@silkbot.com" },
    { name: "Isaac Oluwatemilorun", email: "isaac@silkbot.com" },
    { name: "David Oshodi", email: "david@silkbot.com" },
  ];

  const topics = [
    "Mise à jour du projet",
    "Rapport hebdomadaire",
    "Réunion technique",
    "Feedback sur le design",
    "Nouveau collaborateur",
  ];

  const previews = [
    "Voici les dernières modifications apportées au projet...",
    "Le rapport de cette semaine est disponible...",
    "Confirmation de la réunion de demain à 14h...",
    "J'ai revu les maquettes et voici mes retours...",
    "Bienvenue à notre nouveau membre...",
  ];

  return mockUsers.map((user, index) => ({
    id: `mock-msg-${index}`,
    from: user.name,
    fromEmail: user.email,
    subject: topics[index % topics.length],
    preview: previews[index % previews.length],
    date: formatRelativeTime(new Date(Date.now() - (index * 3600000)).toISOString()),
    read: index % 2 === 0,
    starred: index % 3 === 0,
    hasAttachment: index % 2 === 0,
    labels: index % 2 === 0 ? ["important"] : [],
    timestamp: Date.now() - (index * 3600000),
  }));
}

// ============ FONCTIONS ACTIONS ============

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  // Dans une vraie application, vous feriez un appel API
  console.log(`Marquer notification ${notificationId} comme lue`);
  return Promise.resolve();
}

export async function markAllNotificationsAsRead(): Promise<void> {
  console.log("Marquer toutes les notifications comme lues");
  return Promise.resolve();
}

export async function deleteNotification(notificationId: string): Promise<void> {
  console.log(`Supprimer notification ${notificationId}`);
  return Promise.resolve();
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  console.log(`Marquer message ${messageId} comme lu`);
  return Promise.resolve();
}

export async function toggleMessageStar(messageId: string): Promise<void> {
  console.log(`Toggle star pour message ${messageId}`);
  return Promise.resolve();
}

export async function deleteMessage(messageId: string): Promise<void> {
  console.log(`Supprimer message ${messageId}`);
  return Promise.resolve();
}

export async function sendMessage(to: string, subject: string, content: string): Promise<any> {
  console.log(`Envoyer message à ${to}: ${subject}`);
  return Promise.resolve({ success: true });
}

// ============ FONCTIONS UPLOAD ============

export async function uploadDocument(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/admin/document-ref/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erreur lors de l'upload");
  }

  return res.json();
}