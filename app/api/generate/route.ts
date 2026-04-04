import { NextRequest, NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { buildPrompt } from "@/lib/prompts";
import { generateReply } from "@/lib/llm";
import { INTENSITIES, MOODS } from "@/lib/types";
import type { Intensity, Mood } from "@/lib/types";

function isMood(v: string): v is Mood {
  return (MOODS as readonly string[]).includes(v);
}

function isIntensity(v: string): v is Intensity {
  return (INTENSITIES as readonly string[]).includes(v);
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

    if (!allowRequest(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Try again in a minute." },
        { status: 429 }
      );
    }

    const { text, details, memory, mood, intensity, previousMain, _hp } = await req.json();

    // Honeypot — bots fill hidden fields, humans don't
    if (_hp) {
      return NextResponse.json({ error: "nope." }, { status: 400 });
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "type something real." },
        { status: 400 }
      );
    }

    // Reject inputs that are too long or contain no letters
    if (text.length > 300) {
      return NextResponse.json(
        { error: "keep it shorter." },
        { status: 400 }
      );
    }

    if (!/[a-zA-Z]/.test(text)) {
      return NextResponse.json(
        { error: "type something real." },
        { status: 400 }
      );
    }

    const safeMood: Mood = isMood(mood) ? mood : "guilt";
    const safeIntensity: Intensity = isIntensity(intensity) ? intensity : "brutal";

    const finalDetails = typeof details === "string" ? details : "";
    const finalPreviousMain = typeof previousMain === "string" ? previousMain : "";

    const prompt = buildPrompt(
      text,
      safeMood,
      safeIntensity,
      memory,
      finalDetails,
      finalPreviousMain
    );

    const result = await getBestReceiptReply(prompt, finalPreviousMain);

    return NextResponse.json(
      result ?? {
        main: "printer jammed. try again.",
        best: "You do it.",
        worst: "You stall again.",
      }
    );

  } catch {
    return NextResponse.json(
      {
        main: "printer jammed. try again.",
        best: "You do it.",
        worst: "You stall again.",
      },
      { status: 500 }
    );
  }
}

// Normalise leet-speak and spacing before checking
function normaliseForSafety(text: string) {
  return text
    .toLowerCase()
    .replace(/[1!]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[0]/g, "o")
    .replace(/[4@]/g, "a")
    .replace(/\s+/g, " ")
    .trim();
}

const BLOCKED_PATTERNS = [
  /\bsuicid/,
  /\bself.?harm/,
  /\bkill\s+yourself/,
  /\bkys\b/,
  /\brap(e|ed|ing)\b/,
  /\bmolest/,
  /\bpedophil/,
  /\bchild.?abuse/,
  /\bnigger\b/,
  /\bnigga\b/,
  /\bfaggot\b/,
  /\bshoot\s+up\b/,
];

function isSafeOutput(result: { main: string; best: string; worst: string }) {
  const combined = normaliseForSafety(`${result.main} ${result.best} ${result.worst}`);
  return !BLOCKED_PATTERNS.some((pattern) => pattern.test(combined));
}

async function getBestReceiptReply(prompt: string, previousMain: string) {
  const providers: Array<"groq" | "llm7"> = process.env.GROQ_API_KEY
    ? ["groq", "llm7"]
    : ["llm7"];

  for (const provider of providers) {
    try {
      const result = await generateReply({ prompt, provider });

      if (result.main.length < 20) continue;
      if (!isSafeOutput(result)) continue;
      if (isTooSimilarToPrevious(result.main, previousMain)) continue;

      return result;
    } catch (error) {
      console.error(`[generate] ${provider} failed`, error);
    }
  }

  return null;
}

function isTooSimilarToPrevious(main: string, previousMain: string) {
  const current = normalize(main);
  const previous = normalize(previousMain);
  if (!current || !previous) return false;
  if (current === previous) return true;
  if (current.includes(previous) || previous.includes(current)) return true;

  const currentWords = Array.from(new Set(current.split(" ").filter(Boolean)));
  const previousWords = new Set(previous.split(" ").filter(Boolean));
  const overlap = currentWords.filter((w) => previousWords.has(w)).length;
  return overlap / Math.max(1, currentWords.length) >= 0.72;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
