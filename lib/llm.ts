// LLM7.io — completely free, no API key, no account, no login required.
// OpenAI-compatible endpoint. Just works.
const LLM7_URL = "https://api.llm7.io/v1/chat/completions";

export type ReceiptResponse = {
  main: string;
  best: string;
  worst: string;
};

export async function generateReply(input: {
  prompt: string;
}): Promise<ReceiptResponse> {
  const res = await fetch(LLM7_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.72,
      messages: [{ role: "user", content: input.prompt }]
    })
  });

  if (!res.ok) {
    throw new Error(`LLM7 request failed: ${res.status}`);
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
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return sentences.join(" ").slice(0, 220).trim();
}

function clipOutcome(value: string) {
  const clean = sanitize(value);
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return sentences.join(" ").slice(0, 90).trim();
}
