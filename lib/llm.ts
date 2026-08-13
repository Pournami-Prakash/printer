const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const LLM7_URL = "https://api.llm7.io/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const LLM7_MODEL = "gpt-4o-mini";
const PROVIDER_TIMEOUT_MS = 15_000;

export type ModelProvider = "groq" | "llm7";

export type ReceiptResponse = {
  main: string;
  best: string;
  worst: string;
};

export async function generateReply(input: {
  prompt: string;
  provider?: ModelProvider;
}): Promise<ReceiptResponse> {
  const provider = input.provider ?? (process.env.GROQ_API_KEY ? "groq" : "llm7");
  return requestProvider(provider, input.prompt);
}

async function requestProvider(provider: ModelProvider, prompt: string): Promise<ReceiptResponse> {
  const groqKey = process.env.GROQ_API_KEY;
  if (provider === "groq" && !groqKey) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const endpoint = provider === "groq" ? GROQ_URL : LLM7_URL;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider === "groq") {
    headers.Authorization = `Bearer ${groqKey}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    body: JSON.stringify({
      model: provider === "groq" ? GROQ_MODEL : LLM7_MODEL,
      temperature: 0.72,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    throw new Error(`${provider} returned HTTP ${res.status}`);
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content ?? "";

  const cleaned = raw.replace(/```json|```/g, "").trim();

  // ✅ try JSON first
  try {
    const parsed = JSON.parse(cleaned);

    if (
      typeof parsed?.main === "string" &&
      typeof parsed?.best === "string" &&
      typeof parsed?.worst === "string"
    ) {
      return {
        main: clipMain(parsed.main),
        best: clipOutcome(parsed.best),
        worst: clipOutcome(parsed.worst),
      };
    }
  } catch {}

  const single = clipMain(cleaned);
  return {
    main: single || "printer jammed. try again.",
    best: "You do it.",
    worst: "You stall again.",
  };
}

function sanitize(value: string) {
  return value
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clipMain(value: string) {
  const clean = sanitize(value);
  const sentences = clean
    .replace(/"[^"]*"/g, (match) => match.replace(/[.!?]/g, "·"))
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 1);
  return sentences.join(" ").replace(/·/g, ".").slice(0, 160).trim();
}

function clipOutcome(value: string) {
  const clean = sanitize(value);
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return sentences.join(" ").slice(0, 80).trim();
}
