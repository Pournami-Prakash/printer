import { NextRequest, NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { buildPrompt } from "@/lib/prompts";
import { generateReply } from "@/lib/llm";
import type { Intensity, Mood } from "@/lib/types";

function isMood(v: string): v is Mood {
  return ["drama", "guilt", "hug", "doom", "goblin", "hype", "nice"].includes(v);
}

function isIntensity(v: string): v is Intensity {
  return ["soft", "brutal", "unhinged"].includes(v);
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

    const { text, details, memory, mood, intensity, variationSeed, previousMain } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "type something real." },
        { status: 400 }
      );
    }

    const safeMood: Mood = isMood(mood) ? mood : "guilt";
    const safeIntensity: Intensity = isIntensity(intensity) ? intensity : "brutal";

    const finalDetails = typeof details === "string" ? details : "";
    const finalVariationSeed =
      typeof variationSeed === "number" && Number.isFinite(variationSeed)
        ? variationSeed
        : Math.floor(Math.random() * 1000000);

    const finalPreviousMain = typeof previousMain === "string" ? previousMain : "";

    const prompt = buildPrompt(
      text,
      safeMood,
      safeIntensity,
      memory,
      finalDetails,
      finalVariationSeed,
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

async function getBestReceiptReply(prompt: string, previousMain: string) {
  const providers: Array<"groq" | "llm7"> = process.env.GROQ_API_KEY
    ? ["groq", "llm7"]
    : ["llm7"];

  for (const provider of providers) {
    try {
      const result = await generateReply({ prompt, provider });

      if (result.main.length < 20) continue;
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
