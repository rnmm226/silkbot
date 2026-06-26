"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { 
  FileText, 
  User, 
  Upload, 
  CheckCircle, 
  Trash2, 
  RefreshCw,
  Activity as ActivityIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchActivities, type Activity } from "@/lib/api/admin";

const iconMap = {
  upload: { icon: Upload, color: "bg-emerald-500" },
  verify: { icon: CheckCircle, color: "bg-blue-500" },
  user: { icon: User, color: "bg-purple-500" },
  delete: { icon: Trash2, color: "bg-red-500" },
  update: { icon: RefreshCw, color: "bg-amber-500" },
};

interface RecentActivityProps {
  limit?: number;
  className?: string;
}

export function RecentActivity({ limit = 10, className }: RecentActivityProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivities = async () => {
      try {
        setLoading(true);
        const data = await fetchActivities(limit);
        setActivities(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
  }, [limit]);

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-6">Activité récente</h2>
        <div className="space-y-4">
          {Array.from({ length: Math.min(limit, 4) }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-6">Activité récente</h2>
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ActivityIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Impossible de charger les activités</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-6">Activité récente</h2>
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ActivityIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucune activité récente</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-6 transition-all duration-500 hover:shadow-xl animate-slide-in-up", className)}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">Activité récente</h2>
        <span className="text-xs text-muted-foreground">
          {activities.length} activité(s)
        </span>
      </div>
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const IconConfig = iconMap[activity.type] || iconMap.upload;
          const Icon = IconConfig.icon;
          
          return (
            <div
              key={activity.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-all duration-300 cursor-pointer group"
              style={{ animationDelay: `${400 + index * 100}ms` }}
            >
              <div className={`${IconConfig.color} w-10 h-10 rounded-lg flex items-center justify-center text-white transition-transform duration-300 group-hover:scale-110`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">{activity.title}</p>
                <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-none">
                  {activity.description}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}