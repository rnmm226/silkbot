"use client"
import Image from "next/image";
import Link from "next/link";
import {  useState, useEffect, useRef, useCallback} from "react"
import { useRouter } from "next/navigation"
import { generateId } from "ai"
import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SearchIcon,
  SparklesIcon,
  MessageSquareIcon,
  Settings2Icon,
  HelpCircleIcon,
  ClockIcon,
  LogOutIcon,
  UserIcon,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Share2,
  Trash2,
  Star,
  StarOff,
} from "lucide-react"
import * as React from "react"
import { authClient } from "@/lib/auth-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const data = {
  navMain: [
    {
      title: "Rechercher",
      url: "#",
      icon: <SearchIcon />,
    },
    {
      title: "Nouvelle conversation",
      url: "#",
      icon: <SparklesIcon />,
    },
  ],
  navSecondary: [
    {
      title: "Paramètres",
      url: "/dashboard/settings",
      icon: <Settings2Icon />,
    },
    {
      title: "Aide",
      url: "/dashboard/guide",
      icon: <HelpCircleIcon />,
    },
  ],
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Chat {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  lastMessage: string;
  messageCount: number;
  pinned?: boolean;
}

// ─────────────────────────────────────────────
// Composant ConversationItem avec menu à 3 points
// ─────────────────────────────────────────────

function ConversationItem({ 
  chat, 
  onSelect, 
  onRename, 
  onPin, 
  onUnpin,
  onShare, 
  onDelete,
  isPinned = false
}: { 
  chat: Chat;
  onSelect: (id: string) => void;
  onRename: (id: string, newTitle: string) => Promise<void>;
  onPin: (id: string) => Promise<void>;
  onUnpin: (id: string) => Promise<void>;
  onShare: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isPinned: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(chat.title);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRename = async () => {
    if (newTitle.trim() && newTitle !== chat.title) {
      await onRename(chat.id, newTitle.trim());
      toast.success('Conversation renommée');
    }
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(chat.id);
      toast.success('Conversation supprimée');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    await onShare(chat.id);
    setIsShared(true);
    setTimeout(() => setIsShared(false), 3000);
  };

  const handlePinToggle = async () => {
    if (isPinned) {
      await onUnpin(chat.id);
      toast.info('Conversation dépinnée');
    } else {
      await onPin(chat.id);
      toast.success('Conversation épinglée');
    }
  };

  return (
    <>
      <div
        onClick={() => onSelect(chat.id)}
        className="group w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150
          hover:bg-sidebar-accent/60 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground relative"
      >
        <div className="flex items-start gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isPinned && (
                <Pin className="w-3 h-3 shrink-0 text-sidebar-foreground/30" />
              )}
              <div className="truncate text-xs font-medium text-sidebar-foreground/80 group-hover:text-sidebar-accent-foreground leading-tight">
                {chat.title || 'Nouvelle conversation'}
              </div>
            </div>
            {chat.lastMessage && (
              <div className="truncate text-[11px] text-sidebar-foreground/40 font-light mt-0.5 leading-tight">
                {chat.lastMessage}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] text-sidebar-foreground/25 font-light">
                {new Date(chat.updatedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              {chat.messageCount > 0 && (
                <span className="text-[9px] text-sidebar-foreground/20">
                  · {chat.messageCount} msg
                </span>
              )}
            </div>
          </div>

          {/* Menu à 3 points */}
          <div ref={menuRef} className="shrink-0">
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-sidebar-accent/80"
                >
                  <MoreHorizontal className="w-4 h-4 text-sidebar-foreground/50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                  {chat.title || 'Conversation'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Renommer
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={handlePinToggle}>
                  {isPinned ? (
                    <>
                      <PinOff className="w-3.5 h-3.5 mr-2" />
                      Désépingler
                    </>
                  ) : (
                    <>
                      <Pin className="w-3.5 h-3.5 mr-2" />
                      Épingler
                    </>
                  )}
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="w-3.5 h-3.5 mr-2" />
                  Partager
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Dialog de renommage */}
      <Dialog open={isRenaming} onOpenChange={setIsRenaming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renommer la conversation</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              placeholder="Nouveau titre"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenaming(false)}>
              Annuler
            </Button>
            <Button onClick={handleRename}>
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette conversation ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────
// Composant principal AppSidebarHistory
// ─────────────────────────────────────────────

export function AppSidebarHistory({ searchQuery = "" }: { searchQuery?: string }) {
  const router = useRouter()
  const [chats, setChats] = useState<Chat[]>([])
  const [pinnedChats, setPinnedChats] = useState<Chat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isFetching = useRef(false)

  const fetchChats = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) return
    
    isFetching.current = true
    setIsLoading(true)
    setError(null)
    
    try {
      const url = searchQuery
        ? `/api/chat?q=${encodeURIComponent(searchQuery)}`
        : '/api/chat'
      const resp = await fetch(url)
      
      if (!resp.ok) {
        throw new Error(`Failed to fetch chats: ${resp.status}`)
      }
      
      const data = await resp.json()
      
      if (!isMounted.current) return
      
      const allChats = Array.isArray(data) ? data : []
      const pinned = allChats.filter((c: Chat) => c.pinned)
      const unpinned = allChats.filter((c: Chat) => !c.pinned)
      
      setPinnedChats(pinned)
      setChats(unpinned)
      setError(null)
    } catch (error) {
      console.error('Error fetching chats:', error)
      if (isMounted.current) {
        setError('Impossible de charger les conversations')
        setChats([])
        setPinnedChats([])
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false)
      }
      isFetching.current = false
    }
  }, [searchQuery])

  // Debounced version for event handlers
  const debouncedFetchChats = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchChats()
    }, 300)
  }, [fetchChats])

  useEffect(() => {
    isMounted.current = true
    
    // Initial fetch
    fetchChats()
    
    const handleChatUpdate = () => {
      debouncedFetchChats()
    }
    
    window.addEventListener('chat-updated', handleChatUpdate)
    
    return () => {
      isMounted.current = false
      window.removeEventListener('chat-updated', handleChatUpdate)
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, [fetchChats, debouncedFetchChats])

  // ─────────────────────────────────────────────
  // Actions - Remove direct fetchChats calls
  // ─────────────────────────────────────────────

  const handleSelect = (id: string) => {
    router.push(`/dashboard/${id}`)
  }

  const handleRename = async (id: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/chat/${id}/title`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })
      
      if (!response.ok) throw new Error('Failed to rename')
      
      // Only dispatch event, don't call fetchChats directly
      window.dispatchEvent(new Event('chat-updated'))
    } catch (error) {
      console.error('Error renaming chat:', error)
      throw error
    }
  }

  const handlePin = async (id: string) => {
    try {
      await fetch(`/api/chat/${id}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      window.dispatchEvent(new Event('chat-updated'))
    } catch (error) {
      console.error('Error pinning chat:', error)
      throw error
    }
  }

  const handleUnpin = async (id: string) => {
    try {
      await fetch(`/api/chat/${id}/pin`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      window.dispatchEvent(new Event('chat-updated'))
    } catch (error) {
      console.error('Error unpinning chat:', error)
      throw error
    }
  }

  const handleShare = async (id: string) => {
    try {
      const url = `${window.location.origin}/dashboard/${id}`
      await navigator.clipboard.writeText(url)
      toast.success('Lien copié dans le presse-papier !')
    } catch (error) {
      console.error('Error sharing chat:', error)
      toast.error('Erreur lors du partage')
      throw error
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/chat/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) throw new Error('Failed to delete')
      
      window.dispatchEvent(new Event('chat-updated'))
    } catch (error) {
      console.error('Error deleting chat:', error)
      throw error
    }
  }
  // ─────────────────────────────────────────────
  // Groupement des conversations par période
  // ─────────────────────────────────────────────

  const groupChatsByDate = (chats: Chat[]) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const groups: { [key: string]: Chat[] } = {
      'Aujourd\'hui': [],
      'Hier': [],
      '7 derniers jours': [],
      '30 derniers jours': [],
      'Plus ancien': [],
    }

    chats.forEach(chat => {
      const chatDate = new Date(chat.updatedAt)
      
      if (chatDate >= today) {
        groups['Aujourd\'hui'].push(chat)
      } else if (chatDate >= yesterday) {
        groups['Hier'].push(chat)
      } else if (chatDate >= sevenDaysAgo) {
        groups['7 derniers jours'].push(chat)
      } else if (chatDate >= thirtyDaysAgo) {
        groups['30 derniers jours'].push(chat)
      } else {
        groups['Plus ancien'].push(chat)
      }
    })

    // Filtrer les groupes vides
    return Object.fromEntries(
      Object.entries(groups).filter(([, chats]) => chats.length > 0)
    )
  }

  // ─────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="px-3 py-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-sidebar-foreground/20 border-t-sidebar-foreground/60 rounded-full animate-spin" />
          <p className="text-[11px] text-sidebar-foreground/30 font-light">
            Chargement...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-[11px] text-red-500/70 font-light">
          {error}
        </p>
        <button 
          onClick={fetchChats}
          className="mt-2 text-[10px] text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
        >
          Réessayer
        </button>
      </div>
    )
  }

  const allChats = [...pinnedChats, ...chats]
  
  if (allChats.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-[11px] text-sidebar-foreground/30 font-light">
          {searchQuery ? 'Aucun résultat' : 'Aucune conversation'}
        </p>
        {!searchQuery && (
          <p className="text-[10px] text-sidebar-foreground/20 font-light mt-1">
            Commencez une nouvelle conversation
          </p>
        )}
      </div>
    )
  }

  // Si recherche, afficher sans groupement
  if (searchQuery) {
    return (
      <div className="space-y-0.5 px-2">
        {allChats.map((chat) => (
          <ConversationItem
            key={chat.id}
            chat={chat}
            onSelect={handleSelect}
            onRename={handleRename}
            onPin={handlePin}
            onUnpin={handleUnpin}
            onShare={handleShare}
            onDelete={handleDelete}
            isPinned={pinnedChats.some(c => c.id === chat.id)}
          />
        ))}
      </div>
    )
  }

  // Affichage avec groupement
  const groupedChats = groupChatsByDate(chats)
  const hasPinned = pinnedChats.length > 0

  return (
    <div className="space-y-3 px-2">
      {/* Conversations épinglées */}
      {hasPinned && (
        <div>
          <div className="flex items-center gap-1.5 px-1 pb-1.5">
            <Pin className="w-3 h-3 text-sidebar-foreground/30" />
            <span className="text-[9px] font-medium tracking-[0.1em] uppercase text-sidebar-foreground/30">
              Épinglées
            </span>
          </div>
          {pinnedChats.map((chat) => (
            <ConversationItem
              key={chat.id}
              chat={chat}
              onSelect={handleSelect}
              onRename={handleRename}
              onPin={handlePin}
              onUnpin={handleUnpin}
              onShare={handleShare}
              onDelete={handleDelete}
              isPinned={true}
            />
          ))}
        </div>
      )}

      {/* Conversations groupées par période */}
      {Object.entries(groupedChats).map(([period, chats]) => (
        <div key={period}>
          <div className="flex items-center gap-1.5 px-1 pb-1.5">
            <ClockIcon className="w-3 h-3 text-sidebar-foreground/25" />
            <span className="text-[9px] font-medium tracking-[0.1em] uppercase text-sidebar-foreground/25">
              {period}
            </span>
          </div>
          {chats.map((chat) => (
            <ConversationItem
              key={chat.id}
              chat={chat}
              onSelect={handleSelect}
              onRename={handleRename}
              onPin={handlePin}
              onUnpin={handleUnpin}
              onShare={handleShare}
              onDelete={handleDelete}
              isPinned={false}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Composant principal AppSidebar
// ─────────────────────────────────────────────

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [logoError, setLogoError] = useState(false);

  const handleNewChat = async () => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      
      if (!response.ok) throw new Error('Failed to create chat')
      
      const data = await response.json()
      router.push(`/dashboard/${data.id}`)
      setTimeout(() => window.dispatchEvent(new Event('chat-updated')), 500)
    } catch (error) {
      console.error('Error creating new chat:', error)
      const newId = generateId()
      router.push(`/dashboard/${newId}`)
      setTimeout(() => window.dispatchEvent(new Event('chat-updated')), 500)
    }
  }

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login")
        },
      },
    })
  }

  const navMainWithActions = data.navMain.map(item => {
    if (item.title === "Nouvelle conversation") return { ...item, onClick: handleNewChat }
    if (item.title === "Rechercher") return { ...item, onClick: () => setSearchOpen(v => !v) }
    return item
  })

  const navSecondaryWithActions = data.navSecondary.map(item => ({
    ...item,
    onClick: () => router.push(item.url),
  }))

  const initials = session?.user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  return (
    <Sidebar className="border-r border-sidebar-border/50" {...props}>

      {/* ── Header ── */}
      <SidebarHeader className="pb-0">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div>
            <Link href="/" className="flex items-center gap-2 mr-2">
              <div
                className="flex size-6 items-center justify-center rounded-md overflow-hidden"
                style={{ background: 'var(--primary)' }}
              >
                {logoError ? (
                  <span className="text-xs font-bold" style={{ color: 'var(--primary-foreground)' }}>⚖️</span>
                ) : (
                  <Image
                    src="/silkbot-logo-white.png"
                    alt="SilkBot Logo"
                    width={24}
                    height={24}
                    className="object-contain"
                    onError={() => setLogoError(true)}
                  />
                )}
              </div>
              {!logoError && (
                <Image
                  src="/silkbot-black.png"
                  alt="SilkBot"
                  width={70}
                  height={22}
                  className="object-contain block dark:hidden"
                  onError={() => setLogoError(true)}
                />
              )}
            </Link>
          </div>
          <div>
            <p className="text-[10px] text-sidebar-foreground/35 font-light leading-none mt-0.5">
              Plateforme juridique
            </p>
          </div>
        </div>

        <SidebarSeparator className="opacity-20 mx-3" />

        {/* Nav actions */}
        <div className="px-2 pt-2 pb-1">
          <NavMain items={navMainWithActions} />
        </div>

        {/* Search input */}
        {searchOpen && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 bg-sidebar-accent/30 border border-sidebar-border/40 rounded-lg px-2.5 py-1.5">
              <SearchIcon className="w-3 h-3 text-sidebar-foreground/40 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Rechercher…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/30 focus:outline-none font-light"
              />
            </div>
          </div>
        )}

        <SidebarSeparator className="opacity-20 mx-3" />

        {/* Section label */}
        <div className="flex items-center gap-1.5 px-5 pt-3 pb-1.5">
          <ClockIcon className="w-3 h-3 text-sidebar-foreground/30" />
          <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-sidebar-foreground/30">
            Récent
          </span>
        </div>
      </SidebarHeader>

      {/* ── Conversations ── */}
      <SidebarContent className="overflow-y-auto">
        <AppSidebarHistory searchQuery={searchOpen ? searchQuery : ""} />
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="border-t border-sidebar-border/30 pb-3 pt-2">
        <SidebarSeparator className="opacity-20 mx-3 my-1" />

        {session?.user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-full flex items-center gap-2.5 px-4 py-1.5 rounded-lg
                  hover:bg-sidebar-accent/40 transition-colors text-left"
              >
                <div className="w-6 h-6 rounded-md bg-sidebar-accent/50 flex items-center justify-center text-[10px] font-medium text-sidebar-accent-foreground shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-sidebar-foreground/70 truncate leading-tight">
                    {session.user.name}
                  </div>
                  <div className="text-[10px] text-sidebar-foreground/30 font-light truncate leading-tight">
                    {session.user.email}
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="font-light text-[11px] text-muted-foreground">
                {session.user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                <Settings2Icon className="w-3.5 h-3.5 mr-2" />
                Paramètres
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/guide')}>
                <HelpCircleIcon className="w-3.5 h-3.5 mr-2" />
                Aide
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOutIcon className="w-3.5 h-3.5 mr-2" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}