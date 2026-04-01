export type Mood = "drama" | "guilt" | "hug" | "doom" | "goblin" | "hype" | "nice";
export type Intensity = "soft" | "brutal" | "unhinged";

export type LlmPayload = {
  roast: string;
  parents: string;
  care: string;
  quote: string;
  joke: string;
  best: string;
  worst: string;
};

export type HistoryEntry = {
  id: string;
  date: string;
  mood: Mood;
  text: string;
  intensity: Intensity;
  response: LlmPayload;
};

export type MemoryPattern = {
  title: string;
  detail: string;
};
