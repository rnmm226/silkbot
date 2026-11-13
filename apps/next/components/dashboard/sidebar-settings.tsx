"use client";

import {
  BellIcon,
  LockIcon,
  LogOutIcon,
  PaletteIcon,
  UserIcon,
  ArrowLeftIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "profile",       label: "Profil",        icon: UserIcon },
  { id: "security",      label: "Sécurité",       icon: LockIcon },
  { id: "notifications", label: "Notifications",  icon: BellIcon },
  { id: "appearance",    label: "Apparence",      icon: PaletteIcon },
];

interface SidebarSettingsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onBack: () => void;
}

export function SidebarSettings({
  activeTab,
  onTabChange,
  onLogout,
  onBack,
}: SidebarSettingsProps) {
  return (
    <aside className="w-52 shrink-0 border-r border-border px-3 py-4 flex flex-col gap-1">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 px-2"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        Retour
      </button>

      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left w-full transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {tab.label}
          </button>
        );
      })}

      <div className="mt-auto pt-4 border-t border-border">
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOutIcon className="w-4 h-4 shrink-0" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
