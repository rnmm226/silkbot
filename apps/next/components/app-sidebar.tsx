"use client"
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react"
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
  ScaleIcon,
  MessageSquareIcon,
  Settings2Icon,
  HelpCircleIcon,
  ClockIcon,
  LogOutIcon,
  UserIcon,
} from "lucide-react"
import * as React from "react"
import { authClient } from "@/lib/auth-client"
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
        <p className="text-[11px] text-sidebar-foreground/30 font-light">
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
          className="group w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150
            hover:bg-sidebar-accent/60 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
        >
          <div className="flex items-start gap-2.5">
            <MessageSquareIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-40 group-hover:opacity-70 transition-opacity" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-sidebar-foreground/80 group-hover:text-sidebar-accent-foreground leading-tight">
                {e.title}
              </div>
              {e.lastMessage && (
                <div className="truncate text-[11px] text-sidebar-foreground/40 font-light mt-0.5 leading-tight">
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
  const { data: session } = authClient.useSession()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [logoError, setLogoError] = useState(false);

  const handleNewChat = () => {
    const newId = generateId()
    router.push(`/dashboard/${newId}`)
    setTimeout(() => window.dispatchEvent(new Event('chat-updated')), 500)
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
         <span> 
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
            </span>
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

        {/* User info — click to open account menu */}
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
