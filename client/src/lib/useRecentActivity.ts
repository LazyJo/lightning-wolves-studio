import { useState, useCallback } from "react";

export interface Activity {
  id: string;
  tool: string;
  title: string;
  timestamp: number;
  credits?: number;
}

const STORAGE_KEY = "lw-recent-activity";
const MAX_ITEMS = 10;

function loadActivities(): Activity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveActivities(items: Activity[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export function useRecentActivity() {
  const [activities, setActivities] = useState<Activity[]>(loadActivities);

  const addActivity = useCallback((tool: string, title: string, credits?: number) => {
    const item: Activity = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tool,
      title,
      timestamp: Date.now(),
      credits,
    };
    setActivities((prev) => {
      const next = [item, ...prev].slice(0, MAX_ITEMS);
      saveActivities(next);
      return next;
    });
  }, []);

  const clearActivities = useCallback(() => {
    setActivities([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { activities, addActivity, clearActivities };
}

export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}
