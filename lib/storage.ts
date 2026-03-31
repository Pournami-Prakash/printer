import { HistoryEntry, MemoryPattern } from "./types";

const HISTORY_KEY = "brutalcare.history.v1";
const STREAK_KEY = "brutalcare.streak.v1";
const SURVIVE_KEY = "brutalcare.survived.v1";

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const existing = loadHistory();
  const next = [entry, ...existing].slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function markSurvivedToday(): { streak: number; didIncrement: boolean } {
  if (typeof window === "undefined") return { streak: 0, didIncrement: false };
  const today = new Date().toISOString().slice(0, 10);
  const streakRaw = localStorage.getItem(STREAK_KEY);
  const surviveRaw = localStorage.getItem(SURVIVE_KEY);

  let streak = 0;
  let lastDate = "";
  if (streakRaw) {
    try {
      const parsed = JSON.parse(streakRaw) as { streak: number; lastDate: string };
      streak = parsed.streak;
      lastDate = parsed.lastDate;
    } catch {}
  }

  if (surviveRaw === today) {
    return { streak, didIncrement: false };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.toISOString().slice(0, 10);

  const nextStreak = lastDate === y ? streak + 1 : 1;
  localStorage.setItem(STREAK_KEY, JSON.stringify({ streak: nextStreak, lastDate: today }));
  localStorage.setItem(SURVIVE_KEY, today);

  return { streak: nextStreak, didIncrement: true };
}

export function getStreak(): number {
  if (typeof window === "undefined") return 0;
  try {
    const parsed = JSON.parse(localStorage.getItem(STREAK_KEY) || '{"streak":0}') as { streak: number };
    return parsed.streak || 0;
  } catch {
    return 0;
  }
}

function bucketText(text: string): string[] {
  const t = text.toLowerCase();
  const hits: string[] = [];
  const map: Array<[string, RegExp]> = [
    ["avoidance gremlin", /(avoid|avoiding|ignored|ignoring|putting off|procrastinat)/],
    ["deadline chicken", /(deadline|due|tomorrow|late|last minute|submit)/],
    ["catastrophe theatre", /(panic|spiral|doom|ruin|disaster|fail|failing)/],
    ["perfectionism cosplay", /(perfect|perfection|good enough|not ready|polish)/],
    ["energy bankruptcy", /(tired|exhausted|sleep|drained|burnout|burnt out)/],
    ["stuck-in-head syndrome", /(stuck|overthink|frozen|can't start|cannot start|brain fog)/]
  ];

  for (const [label, rx] of map) {
    if (rx.test(t)) hits.push(label);
  }

  return hits;
}

export function deriveMemoryPatterns(history: HistoryEntry[]): MemoryPattern[] {
  if (!history.length) return [];

  const counts = new Map<string, number>();
  const moods = new Map<string, number>();

  for (const entry of history) {
    moods.set(entry.mood, (moods.get(entry.mood) || 0) + 1);
    for (const bucket of bucketText(entry.text)) {
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    }
  }

  const patterns: MemoryPattern[] = [];
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [label, count] of sorted) {
    patterns.push({
      title: `You always do this... ${label}`,
      detail: `This showed up in ${count} of your recent spirals. Your brain really loves a rerun.`
    });
  }

  const topMood = [...moods.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topMood) {
    patterns.push({
      title: `Main character mood: ${topMood[0]}`,
      detail: `You have picked "${topMood[0]}" ${topMood[1]} time${topMood[1] === 1 ? "" : "s"}. The plot is consistent.`
    });
  }

  return patterns.slice(0, 4);
}
