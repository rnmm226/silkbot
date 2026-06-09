"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { generateId } from "ai"
import { NavMain } from "@/components/nav-main"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  SearchIcon,
  SparklesIcon,
  ScaleIcon,
  BookOpenIcon,
  SettingsIcon,
  HelpCircleIcon,
  MessageSquareIcon,
} from "lucide-react"
import * as React from "react"
import { authClient } from "@/lib/auth-client"

const data = {
  teams: [
    {
      name: "SilkBot",
      logo: <ScaleIcon className="w-4 h-4" />,
      plan: "Plateforme juridique",
    },
  ],
  navMain: [
    {
      title: "Recherche",
      url: "#",
      icon: <SearchIcon className="w-4 h-4" />,
    },
    {
      title: "Nouvelle conversation",
      url: "#",
      icon: <SparklesIcon className="w-4 h-4" />,
    },
  ],
  navSecondary: [
    {
      title: "Base légale",
      url: "#",
      icon: <BookOpenIcon className="w-4 h-4" />,
    },
    {
      title: "Paramètres",
      url: "#",
      icon: <SettingsIcon className="w-4 h-4" />,
    },
    {
      title: "Aide",
      url: "#",
      icon: <HelpCircleIcon className="w-4 h-4" />,
    },
  ],
}

export function AppSidebarHistory({ searchQuery = "" }: { searchQuery?: string }) {
  const router = useRouter()
  const [chats, setChats] = useState<any[]>([])

  const fetchChats = () => {
    const url = searchQuery
      ? `/api/chat?q=${encodeURIComponent(searchQuery)}`
      : '/api/chat'
    fetch(url)
      .then(resp => resp.json())
      .then(d => setChats(Array.isArray(d) ? d : []))
      .catch(() => setChats([]))
  }

  useEffect(() => {
    fetchChats()
    window.addEventListener('chat-updated', fetchChats)
    return () => window.removeEventListener('chat-updated', fetchChats)
  }, [searchQuery])

  if (!Array.isArray(chats) || chats.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-xs text-sidebar-foreground/30 font-light">
          Aucune conversation
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5 px-2">
      {chats.map((e) => (
        <button
          key={e.id}
          onClick={() => router.push(`/dashboard/${e.id}`)}
          className="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent group"
        >
          <div className="flex items-start gap-2">
            <MessageSquareIcon className="w-3.5 h-3.5 text-sidebar-foreground/30 group-hover:text-sidebar-accent-foreground/60 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground">
                {e.title}
              </div>
              {e.lastMessage && (
                <div className="truncate text-[11px] text-sidebar-foreground/30 group-hover:text-sidebar-accent-foreground/50 font-light mt-0.5">
                  {e.lastMessage}
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const { data: session } = authClient.useSession()

  const handleNewChat = () => {
    const newId = generateId()
    router.push(`/dashboard/${newId}`)
    setTimeout(() => window.dispatchEvent(new Event('chat-updated')), 500)
  }

  const navMainWithActions = data.navMain.map(item => {
    if (item.title === "Nouvelle conversation") return { ...item, onClick: handleNewChat }
    if (item.title === "Recherche") return { ...item, onClick: () => setSearchOpen(v => !v) }
    return item
  })

  return (
    <Sidebar className="border-r-0" {...props}>
      {/* ── Header : logo ── */}
      <SidebarHeader className="pb-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 py-3">
          <div className="w-7 h-7 rounded-lg bg-sidebar-primary/20 flex items-center justify-center shrink-0">
            <ScaleIcon className="w-4 h-4 text-sidebar-primary" />
          </div>
          <div>
            <span className="font-serif text-sm font-bold text-sidebar-foreground tracking-tight">
              Silk<span className="text-sidebar-primary">Bot</span>
            </span>
            <p className="text-[10px] text-sidebar-foreground/30 font-light leading-none mt-0.5">
              IA juridique
            </p>
          </div>
        </div>

        <SidebarSeparator className="opacity-20 mx-3" />

        {/* Nav actions */}
        <div className="px-2 pt-2 space-y-0.5">
          {navMainWithActions.map((item) => (
            <button
              key={item.title}
              onClick={item.onClick}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                ${item.title === "Nouvelle conversation"
                  ? "bg-sidebar-primary/20 text-sidebar-primary hover:bg-sidebar-primary/30"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
            >
              {item.icon}
              {item.title}
            </button>
          ))}
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="px-2 pt-1 pb-1">
            <input
              autoFocus
              type="text"
              placeholder="Rechercher…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-sidebar-border/40 px-3 py-1.5 text-xs bg-sidebar-accent/30 text-sidebar-foreground placeholder:text-sidebar-foreground/30 focus:outline-none focus:border-sidebar-primary/40 transition-colors"
            />
          </div>
        )}
      </SidebarHeader>

      {/* ── Content : history ── */}
      <SidebarContent className="pt-3">
        {/* Section label */}
        <div className="px-5 mb-2">
          <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-sidebar-foreground/25">
            Conversations
          </p>
        </div>
        <AppSidebarHistory searchQuery={searchOpen ? searchQuery : ""} />
      </SidebarContent>

      {/* ── Footer : secondary nav + user ── */}
      <SidebarFooter className="border-t border-sidebar-border/20 pt-2 pb-3">
        {/* Secondary nav */}
        <div className="px-2 space-y-0.5 mb-2">
          {data.navSecondary.map((item) => (
            <a
              key={item.title}
              href={item.url}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              {item.icon}
              {item.title}
            </a>
          ))}
        </div>

        <SidebarSeparator className="opacity-20 mx-3 mb-2" />

        {/* User */}
        {session?.user && (
          <div className="px-3 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sidebar-accent flex items-center justify-center shrink-0 text-[10px] font-medium text-sidebar-accent-foreground">
              {session.user.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-sidebar-foreground/70 truncate">{session.user.name}</p>
              <p className="text-[10px] text-sidebar-foreground/30 font-light truncate">{session.user.email}</p>
            </div>
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}