"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  PencilIcon,
  ArchiveIcon,
  LinkIcon,
  FileDownIcon,
  Trash2Icon,
  RotateCcwIcon,
  FlagIcon,
  GalleryVerticalEndIcon,
  StarIcon,
  MoreHorizontalIcon,
  ShieldCheckIcon,
  UsersIcon,
  DatabaseIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────
// Actions propres à une conversation (et non à un
// document générique type Notion) : c'est ce qui
// fait que le menu "sent" un vrai produit de chat.
// ─────────────────────────────────────────────
type ActionItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  danger?: boolean;
};

const adminActions = [
  { label: "Administration", icon: ShieldCheckIcon, href: "/admin/vue_ensemble" },
  { label: "Gestion des utilisateurs", icon: UsersIcon, href: "/admin/users" },
  { label: "Base documentaire", icon: DatabaseIcon, href: "/admin/documents" },
];

export type NavActionsProps = {
  isStarred?: boolean;
  onToggleStar?: () => void;
  onRename?: () => void;
  onArchive?: () => void;
  onShare?: () => void;
  onExportPdf?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onReportIssue?: () => void;
  onViewHistory?: () => void;
};

export function NavActions({
  isStarred,
  onToggleStar,
  onRename,
  onArchive,
  onShare,
  onExportPdf,
  onDelete,
  onRegenerate,
  onReportIssue,
  onViewHistory,
}: NavActionsProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [internalStarred, setInternalStarred] = React.useState(false);
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const isAdmin = session?.user?.role === "admin";
  const starred = isStarred ?? internalStarred;

  const toggleStar = () => {
    if (onToggleStar) onToggleStar();
    else setInternalStarred((v) => !v);
  };

  const actionGroups: ActionItem[][] = [
    [
      { label: "Renommer la conversation", icon: PencilIcon, onClick: onRename },
      { label: "Archiver", icon: ArchiveIcon, onClick: onArchive },
    ],
    [
      { label: "Partager", icon: LinkIcon, onClick: onShare },
      { label: "Exporter en PDF", icon: FileDownIcon, onClick: onExportPdf },
      { label: "Supprimer", icon: Trash2Icon, onClick: onDelete, danger: true },
    ],
    [
      { label: "Régénérer la dernière réponse", icon: RotateCcwIcon, onClick: onRegenerate },
      { label: "Signaler une erreur", icon: FlagIcon, onClick: onReportIssue },
      { label: "Historique des échanges", icon: GalleryVerticalEndIcon, onClick: onViewHistory },
    ],
  ];

  return (
    <div className="flex items-center gap-1">
      {/* Favori */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleStar}
        aria-pressed={starred}
        title={starred ? "Retirer des favoris" : "Ajouter aux favoris"}
        className={cn(
          "transition-colors",
          starred ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <StarIcon className={cn("size-4", starred && "fill-primary")} />
      </Button>

      {/* Menu d'actions */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Plus d'options"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-60 p-1">
          {isAdmin && (
            <>
              <div className="py-1">
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
                      <Icon className="size-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="my-1 h-px bg-border" />
            </>
          )}

          {actionGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="my-1 h-px bg-border" />}
              <div className="py-1">
                {group.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        setIsOpen(false);
                        item.onClick?.();
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left text-xs font-light transition-colors",
                        item.danger
                          ? "text-destructive hover:bg-destructive/10"
                          : "text-foreground/80 hover:text-foreground hover:bg-accent/60",
                      )}
                    >
                      <Icon className="size-4" />
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