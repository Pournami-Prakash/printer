export const MOODS = ["drama", "guilt", "hug", "doom", "goblin", "hype", "nice"] as const;
export const INTENSITIES = ["soft", "brutal", "unhinged"] as const;

export type Mood = typeof MOODS[number];
export type Intensity = typeof INTENSITIES[number];
