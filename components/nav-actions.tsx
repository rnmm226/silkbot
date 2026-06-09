"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  BookmarkIcon,
  MoreHorizontalIcon,
  ShareIcon,
  CopyIcon,
  DownloadIcon,
  Trash2Icon,
  RotateCcwIcon,
  HistoryIcon,
  BellIcon,
  ExternalLinkIcon,
} from "lucide-react"

const actions = [
  {
    group: "Conversation",
    items: [
      { label: "Partager", icon: ShareIcon },
      { label: "Copier le lien", icon: CopyIcon },
      { label: "Exporter (PDF)", icon: DownloadIcon },
    ],
  },
  {
    group: "Historique",
    items: [
      { label: "Annuler", icon: RotateCcwIcon },
      { label: "Historique des versions", icon: HistoryIcon },
      { label: "Notifications", icon: BellIcon },
    ],
  },
  {
    group: "Danger",
    items: [
      { label: "Supprimer la conversation", icon: Trash2Icon, danger: true },
    ],
  },
]

export function NavActions() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [bookmarked, setBookmarked] = React.useState(false)

  return (
    <div className="flex items-center gap-1">
      {/* Bookmark */}
      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 transition-colors ${bookmarked ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}
        onClick={() => setBookmarked(v => !v)}
        title={bookmarked ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        <BookmarkIcon className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
      </Button>

      {/* More */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
          >
            <MoreHorizontalIcon className="w-3.5 h-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-52 p-1.5 rounded-xl border border-border/50 shadow-lg bg-popover"
          align="end"
          sideOffset={6}
        >
          {actions.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="h-px bg-border/40 my-1 mx-1" />}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left
                      ${item.danger
                        ? 'text-destructive hover:bg-destructive/8'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                      }`}
                    onClick={() => setIsOpen(false)}
                  >
                    <item.icon className="w-3.5 h-3.5 shrink-0" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="h-px bg-border/40 my-1 mx-1" />
          <div className="px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/40 font-light">TunisiaLaw</span>
            <a
              href="https://tunisialaw.tn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground flex items-center gap-1 transition-colors"
            >
              <ExternalLinkIcon className="w-2.5 h-2.5" />
              Site
            </a>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}