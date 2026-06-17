"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Settings2Icon,
  FileTextIcon,
  LinkIcon,
  CopyIcon,
  CornerUpRightIcon,
  Trash2Icon,
  CornerUpLeftIcon,
  GalleryVerticalEndIcon,
  TrashIcon,
  BellIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  StarIcon,
  MoreHorizontalIcon,
  ShieldCheckIcon,
  UsersIcon,
  DatabaseIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const data = [
  [
    { label: "Personnaliser", icon: Settings2Icon },
    { label: "Convertir en doc", icon: FileTextIcon },
  ],
  [
    { label: "Copier le lien", icon: LinkIcon },
    { label: "Dupliquer", icon: CopyIcon },
    { label: "Déplacer vers", icon: CornerUpRightIcon },
    { label: "Supprimer", icon: Trash2Icon },
  ],
  [
    { label: "Annuler", icon: CornerUpLeftIcon },
    { label: "Historique", icon: GalleryVerticalEndIcon },
    { label: "Corbeille", icon: TrashIcon },
    { label: "Notifications", icon: BellIcon },
  ],
  [
    { label: "Importer", icon: ArrowUpIcon },
    { label: "Exporter", icon: ArrowDownIcon },
  ],
];

// ✅ Actions admin
const adminActions = [
  { label: "Administration", icon: ShieldCheckIcon, href: "/admin" },
  { label: "Gestion des utilisateurs", icon: UsersIcon, href: "/admin/users" },
  { label: "Base documentaire", icon: DatabaseIcon, href: "/admin/documents" },
];

export function NavActions() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [starred, setStarred] = React.useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="flex items-center gap-1">
      {/* Star button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => setStarred(v => !v)}
        title={starred ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        <StarIcon
          className={`w-4 h-4 transition-colors ${starred ? "fill-sidebar-primary text-sidebar-primary" : ""}`}
        />
      </Button>

      {/* More options */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
          >
            <MoreHorizontalIcon className="w-4 h-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-52 p-1 rounded-xl border border-border/60 shadow-lg bg-popover"
          align="end"
          sideOffset={6}
        >
          {isAdmin && (
            <>
              <div className="space-y-0.5">
                {adminActions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        setIsOpen(false);
                        router.push(item.href);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left text-xs font-light transition-colors text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="my-1 h-px bg-border/40 mx-1" />
            </>
          )}

          {data.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && (
                <div className="my-1 h-px bg-border/40 mx-1" />
              )}
              <div className="space-y-0.5">
                {group.map((item) => {
                  const Icon = item.icon;
                  const isDanger = item.label === "Supprimer" || item.label === "Corbeille";
                  return (
                    <button
                      key={item.label}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left text-xs font-light transition-colors ${
                        isDanger
                          ? "text-destructive/70 hover:text-destructive hover:bg-destructive/8"
                          : "text-popover-foreground/70 hover:text-popover-foreground hover:bg-muted/60"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}