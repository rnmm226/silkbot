"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { generateId } from "ai"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NavFavorites } from "@/components/nav-favorites"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavWorkspaces } from "@/components/nav-workspaces"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { TerminalIcon, AudioLinesIcon, SearchIcon, SparklesIcon, HomeIcon, InboxIcon, CalendarIcon, Settings2Icon, BlocksIcon, Trash2Icon, MessageCircleQuestionIcon } from "lucide-react"
import * as React from "react"

const data = {
  teams: [
    {
      name: "Chatbot",
      logo: <TerminalIcon />,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: <AudioLinesIcon />,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: <TerminalIcon />,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Search",
      url: "#",
      icon: <SearchIcon />,
    },
    {
      title: "Ask AI",
      url: "#",
      icon: <SparklesIcon />,
    },
    {
      title: "Home",
      url: "#",
      icon: <HomeIcon />,
      isActive: true,
    },
    {
      title: "Inbox",
      url: "#",
      icon: <InboxIcon />,
      badge: "10",
    },
  ],
  navSecondary: [
    {
      title: "Calendar",
      url: "#",
      icon: <CalendarIcon />,
    },
    {
      title: "Settings",
      url: "#",
      icon: <Settings2Icon />,
    },
    {
      title: "Templates",
      url: "#",
      icon: <BlocksIcon />,
    },
    {
      title: "Trash",
      url: "#",
      icon: <Trash2Icon />,
    },
    {
      title: "Help",
      url: "#",
      icon: <MessageCircleQuestionIcon />,
    },
  ],
}

export function AppSidebarHistory({ searchQuery = "" }: { searchQuery?: string }) {
  const router = useRouter()
  const [chats, setChats] = useState([])

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

  if (!Array.isArray(chats) || chats.length === 0) return null

  return (
    <>
      {chats.map((e) => (
        <button
          key={e.id}
          onClick={() => router.push(`/dashboard/${e.id}`)}
          className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-sidebar-accent hover:text-sidebar-accent-foreground truncate"
        >
          <div className="truncate font-medium">{e.title}</div>
          {e.lastMessage && (
            <div className="truncate text-xs text-muted-foreground">{e.lastMessage}</div>
          )}
        </button>
      ))}
    </>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)

  const handleNewChat = () => {
    const newId = generateId()
    router.push(`/dashboard/${newId}`)
    setTimeout(() => window.dispatchEvent(new Event('chat-updated')), 500) // ✅ AJOUTÉ
  }

  const navMainWithActions = data.navMain.map(item => {
    if (item.title === "Ask AI") return { ...item, onClick: handleNewChat }
    if (item.title === "Search") return { ...item, onClick: () => setSearchOpen(v => !v) }
    return item
  })

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
        <NavMain items={navMainWithActions} />

        {searchOpen && (
          <div className="px-2 pb-1">
            <input
              autoFocus
              type="text"
              placeholder="Chercher une conversation..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded border px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        <AppSidebarHistory searchQuery={searchOpen ? searchQuery : ""} />
      </SidebarHeader>

      <SidebarRail />
    </Sidebar>
  )
}