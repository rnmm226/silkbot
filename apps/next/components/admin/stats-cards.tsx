"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Files, MessageSquare, TrendingUp, Users } from "lucide-react";

interface Stat {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  color: string;
}

export function StatsCards() {
  const [stats, setStats] = useState<Stat[]>([
    { label: "Utilisateurs", value: "—", sub: "comptes enregistrés", icon: Users, color: "text-blue-500" },
    { label: "Documents", value: "—", sub: "dans la base", icon: Files, color: "text-emerald-500" },
    { label: "Conversations", value: "—", sub: "ce mois-ci", icon: MessageSquare, color: "text-violet-500" },
    { label: "Requêtes", value: "—", sub: "aujourd'hui", icon: TrendingUp, color: "text-orange-500" },
  ]);

  useEffect(() => {
    // Fetch real counts from API
    async function load() {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.ok) {
          const data = await res.json();
          setStats([
            { label: "Utilisateurs", value: data.users ?? "—", sub: "comptes enregistrés", icon: Users, color: "text-blue-500" },
            { label: "Documents", value: data.documents ?? "—", sub: "dans la base", icon: Files, color: "text-emerald-500" },
            { label: "Conversations", value: data.chats ?? "—", sub: "ce mois-ci", icon: MessageSquare, color: "text-violet-500" },
            { label: "Requêtes", value: data.messages ?? "—", sub: "aujourd'hui", icon: TrendingUp, color: "text-orange-500" },
          ]);
        }
      } catch {
        // keep defaults
      }
    }
    load();
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {stats.map((s) => (
        <Card key={s.label} className="p-4 flex items-start gap-3">
          <div className={`mt-0.5 ${s.color}`}>
            <s.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
