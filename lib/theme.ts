import { Mood } from "./types";

export const moodTheme: Record<Mood, {
  accent: string;
  glow: string;
  soft: string;
  card: string;
  emoji: string;
  gradient: string;
}> = {
  drama: {
    accent: "#ff7a59",
    glow: "rgba(255, 122, 89, 0.28)",
    soft: "#ffe1d6",
    card: "#5a2e24",
    emoji: "🎭",
    gradient: "linear-gradient(135deg, #fff1d8 0%, #ffc8a5 52%, #ff9d73 100%)"
  },
  guilt: {
    accent: "#ffb84d",
    glow: "rgba(255, 184, 77, 0.28)",
    soft: "#fff0cf",
    card: "#654825",
    emoji: "🫵",
    gradient: "linear-gradient(135deg, #fff3d1 0%, #ffd78f 52%, #ffaf58 100%)"
  },
  hug: {
    accent: "#59c6a7",
    glow: "rgba(89, 198, 167, 0.25)",
    soft: "#daf7ef",
    card: "#25544a",
    emoji: "🫶",
    gradient: "linear-gradient(135deg, #e9fff0 0%, #bff0d8 50%, #79dcb6 100%)"
  },
  doom: {
    accent: "#6f88ff",
    glow: "rgba(111, 136, 255, 0.24)",
    soft: "#e0e7ff",
    card: "#2d3563",
    emoji: "🔮",
    gradient: "linear-gradient(135deg, #e7ebff 0%, #bcc7ff 50%, #8ca1ff 100%)"
  },
  goblin: {
    accent: "#94c94f",
    glow: "rgba(148, 201, 79, 0.28)",
    soft: "#ebf8d5",
    card: "#3c5a28",
    emoji: "👹",
    gradient: "linear-gradient(135deg, #f0ffd7 0%, #c9ee90 50%, #99cb59 100%)"
  }
};
