"use client"

import { useState, useEffect } from "react"
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

// This is sample data.
const data = {
  teams: [
    {
      name: "Chatbot",
      logo: (
        <TerminalIcon
        />
      ),
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: (
        <AudioLinesIcon
        />
      ),
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: (
        <TerminalIcon
        />
      ),
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Search",
      url: "#",
      icon: (
        <SearchIcon
        />
      ),
    },
    
    {
      title: "Ask AI",
      url: "#",
      icon: (
        <SparklesIcon
        />
      ),
    },
    {
      title: "Home",
      url: "#",
      icon: (
        <HomeIcon
        />
      ),
      isActive: true,
    },
    {
      title: "Inbox",
      url: "#",
      icon: (
        <InboxIcon
        />
      ),
      badge: "10",
    },
  ],
  navSecondary: [
    {
      title: "Calendar",
      url: "#",
      icon: (
        <CalendarIcon
        />
      ),
    },
    {
      title: "Settings",
      url: "#",
      icon: (
        <Settings2Icon
        />
      ),
    },
    {
      title: "Templates",
      url: "#",
      icon: (
        <BlocksIcon
        />
      ),
    },
    {
      title: "Trash",
      url: "#",
      icon: (
        <Trash2Icon
        />
      ),
    },
    {
      title: "Help",
      url: "#",
      icon: (
        <MessageCircleQuestionIcon
        />
      ),
    },
  ],
  
  
}
export function AppSidebarHistory(){
  const [chats, setChats] = useState([]);
  
  useEffect(()=> {
      fetch('/api/chat')
        .then(resp=>resp.json())
        .then(d=> {
          if (Array.isArray(d)) {
            setChats(d);
          } else {
            setChats([]);
          }
        })
        .catch(err => {
          console.error('Erreur:', err);
          setChats([]);
        });
  }, [])

  if (!Array.isArray(chats) || chats.length === 0) {
    return null;
  }
  
  return(
    <>
     {chats.map((e) => (
        <button key={e.id}>
          <a href={`/dashboard/${e.id}`}>  {/* ← ICI : backticks et ${} */}
            {e.title}
          </a>
        </button>
     ))}
    </>
  )
}
    
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
        <NavMain items={data.navMain} />
        <AppSidebarHistory  />
      </SidebarHeader>
      
      <SidebarRail />
    </Sidebar>
  )
}