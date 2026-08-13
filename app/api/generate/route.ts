import { NextRequest, NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { buildPrompt } from "@/lib/prompts";
import { generateReply } from "@/lib/llm";
import { INTENSITIES, MOODS } from "@/lib/types";
import type { Intensity, Mood } from "@/lib/types";

const MAX_BODY_LENGTH = 4_000;
const MAX_TEXT_LENGTH = 300;
const MAX_DETAILS_LENGTH = 120;
const MAX_MEMORY_LENGTH = 100;
const MAX_PREVIOUS_MAIN_LENGTH = 160;

type JsonObject = Record<string, unknown>;

function isMood(value: unknown): value is Mood {
  return typeof value === "string" && (MOODS as readonly string[]).includes(value);
}

function isIntensity(value: unknown): value is Intensity {
  return typeof value === "string" && (INTENSITIES as readonly string[]).includes(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers });
}

function readString(
  body: JsonObject,
  key: string,
  maxLength: number,
  required = false
): { value: string } | { error: string } {
  const raw = body[key];

  if (raw === undefined || raw === null) {
    return required ? { error: `${key} is required.` } : { value: "" };
  }

  if (typeof raw !== "string") {
    return { error: `${key} must be text.` };
  }

  const value = raw.trim();
  if (required && !value) return { error: `${key} is required.` };
  if (raw.length > maxLength) return { error: `${key} is too long.` };

  return { value };
}

async function readRequestBody(req: NextRequest): Promise<JsonObject | NextResponse> {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) {
    return errorResponse("request is too large.", 413);
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_LENGTH) {
    return errorResponse("request is too large.", 413);
  }

  try {
    const parsed: unknown = JSON.parse(rawBody);
    return isJsonObject(parsed)
      ? parsed
      : errorResponse("request body must be an object.", 400);
  } catch {
    return errorResponse("request body must be valid JSON.", 400);
  }
}

function getClientIdentifier(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return (forwarded || realIp || "local").slice(0, 64);
}

export async function POST(req: NextRequest) {
  try {
    const rateLimit = await allowRequest(getClientIdentifier(req));

    if (rateLimit.status === "unconfigured" || rateLimit.status === "unavailable") {
      return errorResponse("The printer is temporarily unavailable.", 503);
    }

    if (rateLimit.status === "limited") {
      const retryAfter = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1_000));
      return errorResponse("Too many receipts. Try again in a minute.", 429, {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.reset),
      });
    }

    const body = await readRequestBody(req);
    if (body instanceof NextResponse) return body;

    // Honeypot — bots fill hidden fields, humans don't.
    if (body._hp) return errorResponse("request rejected.", 400);

    const text = readString(body, "text", MAX_TEXT_LENGTH, true);
    const details = readString(body, "details", MAX_DETAILS_LENGTH);
    const memory = readString(body, "memory", MAX_MEMORY_LENGTH);
    const previousMain = readString(body, "previousMain", MAX_PREVIOUS_MAIN_LENGTH);

    if ("error" in text) return errorResponse(text.error, 400);
    if ("error" in details) return errorResponse(details.error, 400);
    if ("error" in memory) return errorResponse(memory.error, 400);
    if ("error" in previousMain) return errorResponse(previousMain.error, 400);

    if (!/\p{L}/u.test(text.value)) {
      return errorResponse("type something with words.", 400);
    }

    if (!isMood(body.mood)) return errorResponse("choose a valid goblin.", 400);
    if (!isIntensity(body.intensity)) return errorResponse("choose a valid intensity.", 400);

    const prompt = buildPrompt(
      text.value,
      body.mood,
      body.intensity,
      memory.value,
      details.value,
      previousMain.value
    );

    const result = await getBestReceiptReply(prompt, previousMain.value);
    if (!result) return errorResponse("The printer jammed. Please try again.", 502);

    return NextResponse.json(result, {
      headers: {
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.reset),
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.name : "UnknownError";
    console.error(`[generate] request failed: ${reason}`);
    return errorResponse("The printer jammed. Please try again.", 500);
  }
}

// Normalise leet-speak and spacing before checking.
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
      const reason = error instanceof Error ? error.message : "unknown error";
      console.error(`[generate] ${provider} failed: ${reason}`);
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
  const overlap = currentWords.filter((word) => previousWords.has(word)).length;
  return overlap / Math.max(1, currentWords.length) >= 0.72;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
