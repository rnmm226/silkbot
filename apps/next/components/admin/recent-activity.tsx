"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { MessageSquare, Upload, UserPlus } from "lucide-react";

interface Activity {
  id: string;
  type: "user" | "document" | "chat";
  label: string;
  sub: string;
  time: string;
}

const iconMap = {
  user: UserPlus,
  document: Upload,
  chat: MessageSquare,
};

const colorMap = {
  user: "text-blue-500 bg-blue-500/10",
  document: "text-emerald-500 bg-emerald-500/10",
  chat: "text-violet-500 bg-violet-500/10",
};

export function RecentActivity({ limit = 10 }: { limit?: number }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/activity?limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          setActivities(data);
        }
      } catch {
        // keep empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [limit]);

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3">Activité récente</h3>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Aucune activité récente</p>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => {
            const Icon = iconMap[a.type];
            const color = colorMap[a.type];
            return (
              <div key={a.id} className="flex items-center gap-3 py-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{a.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{a.sub}</p>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0">{a.time}</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
