import { NextRequest, NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { buildPrompt } from "@/lib/prompts";
import { generateReply } from "@/lib/llm";
import type { Intensity, Mood } from "@/lib/types";

const STOPWORDS = new Set([
  "about", "again", "actually", "after", "applied", "around", "because", "been",
  "being", "cleaned", "could", "delay", "doing", "done", "doomscrolled", "email",
  "exactly", "job", "profession", "title", "work",
  "from", "have", "just", "keep", "later", "like", "maybe", "more", "none", "nowhere",
  "really", "still", "task", "that", "them", "they", "this", "today", "what", "when",
  "where", "which", "while", "with", "would", "your"
]);

const ROAST_MARKERS = [
  "optional",
  "impressive",
  "committed",
  "complicated",
  "downloadable content",
  "confidence",
  "embarrassing",
  "bold",
  "tragic",
  "wild",
  "plot hole",
  "crisis",
  "layaway",
  "whole personality",
  "office clothes",
  "luxury import",
  "crime scene",
  "clown behavior",
  "normal again",
  "self-awareness",
  "level of effort",
  "working overtime",
  "special talent",
  "public service announcement",
  "side quest",
  "deeply unserious",
  "audacity",
  "ambitious",
  "failing",
  "can't",
  "cannot"
] as const;

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

    if (!text || text.length < 5) {
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

    const result = await getBestReceiptReply(prompt, text, finalDetails, safeMood, finalPreviousMain);

    return NextResponse.json(
      result ?? buildFallbackReceipt(text, finalDetails, safeMood, safeIntensity, finalVariationSeed)
    );

  } catch (error) {
    return NextResponse.json(
      {
        lines: ["printer jammed.", "try again."],
      },
      { status: 500 }
    );
  }
}

async function getBestReceiptReply(
  prompt: string,
  text: string,
  details: string,
  mood: Mood,
  previousMain: string
) {
  const attempts: Array<"groq" | "llm7"> = process.env.GROQ_API_KEY ? ["groq", "llm7"] : ["llm7"];

  for (const provider of attempts) {
    try {
      const result = await generateReply({ prompt, provider });
      const grounded = isGroundedResult(result, text, details);
      const acceptable = isAcceptableResult(result, text, details, mood);
      const repeated = isTooSimilarToPrevious(result.main, previousMain);
      if (grounded && acceptable && !repeated) {
        return result;
      }
      console.warn(`[generate] ${provider} returned a weak result`, {
        provider,
        grounded,
        acceptable,
        repeated,
        preview: result.main.slice(0, 180),
      });
    } catch (error) {
      console.error(`[generate] ${provider} failed`, error);
      continue;
    }
  }

  return null;
}

function isTooSimilarToPrevious(main: string, previousMain: string) {
  const current = normalizeForComparison(main);
  const previous = normalizeForComparison(previousMain);
  if (!current || !previous) return false;
  if (current === previous) return true;
  if (current.includes(previous) || previous.includes(current)) return true;

  const currentWords = Array.from(new Set(current.split(" ").filter(Boolean)));
  const previousWords = new Set(previous.split(" ").filter(Boolean));
  const overlap = currentWords.filter((word) => previousWords.has(word)).length;
  const overlapRatio = overlap / Math.max(1, currentWords.length);
  return overlapRatio >= 0.72;
}

function normalizeForComparison(value: string) {
  return tidy(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAcceptableResult(
  result: { main: string; best: string; worst: string },
  text: string,
  details: string,
  mood: Mood
) {
  if (mood === "hype" || mood === "nice") {
    return isSupportiveResult(result, text, details, mood);
  }

  return isRoastyResult(result, text, details);
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4 && !STOPWORDS.has(part));
}

function hasKeyword(haystack: string, source: string) {
  const keywords = Array.from(new Set(tokenize(source))).slice(0, 8);
  if (keywords.length === 0) return false;
  return keywords.some((keyword) => haystack.includes(keyword));
}

function isGroundedResult(
  result: { main: string; best: string; worst: string },
  text: string,
  details: string
) {
  const main = result.main.toLowerCase();
  const combined = `${result.main} ${result.best} ${result.worst}`.toLowerCase();
  const taskGrounded = hasKeyword(main, text);
  const detailsGrounded = details.trim() ? hasKeyword(combined, details) : true;

  return taskGrounded && detailsGrounded;
}

function echoesInputTooLiterally(main: string, text: string) {
  const normalizedMain = normalizeForComparison(main);
  const normalizedText = normalizeForComparison(text);
  if (!normalizedMain || !normalizedText) return false;

  const mainWords = normalizedMain.split(" ").filter(Boolean);
  const textWords = normalizedText.split(" ").filter(Boolean);
  const inputPhrase = textWords.join(" ");
  const longInput = textWords.length >= 5;

  if (longInput && normalizedMain.includes(inputPhrase)) return true;

  const exactSpan = textWords
    .filter((word) => word.length >= 4)
    .slice(0, 8)
    .join(" ");

  if (exactSpan && exactSpan.length >= 18 && normalizedMain.includes(exactSpan)) {
    return true;
  }

  const overlap = textWords.filter((word) => mainWords.includes(word)).length;
  const overlapRatio = overlap / Math.max(1, textWords.length);
  return longInput && overlapRatio >= 0.7;
}

function isShortGenericTask(text: string) {
  const cleaned = normalizeForComparison(text);
  if (!cleaned) return false;
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= 4) return true;

  const basicTaskStarts = [
    "get ",
    "make ",
    "reply ",
    "send ",
    "clean ",
    "cook ",
    "do ",
    "start ",
    "finish ",
    "apply ",
    "go ",
    "text ",
    "call ",
    "write ",
  ];

  return basicTaskStarts.some((start) => cleaned.startsWith(start));
}

function isRoastyResult(
  result: { main: string; best: string; worst: string },
  text: string,
  details: string
) {
  const main = tidy(result.main).toLowerCase();
  const detailKeywords = Array.from(new Set(tokenize(details))).slice(0, 6);
  const combinedInput = `${text} ${details}`.toLowerCase();
  const overlapTerms = Array.from(new Set(tokenize(combinedInput))).slice(0, 10);
  const overlapCount = overlapTerms.filter((term) => main.includes(term)).length;
  const detailHit = detailKeywords.some((term) => main.includes(term));
  const markerHit = ROAST_MARKERS.some((marker) => main.includes(marker));
  const hasQuestion = main.includes("?");
  const hasSecondClause = /[,;:-]/.test(main);
  const hasComparison =
    main.includes("like ") ||
    main.includes(" as if ") ||
    main.includes("treats ") ||
    main.includes("treat ") ||
    main.includes("sounds like");
  const hasBite =
    main.includes("can't ") ||
    main.includes("cannot ") ||
    main.includes("failing") ||
    main.includes("good luck with that") ||
    main.includes("how ambitious") ||
    main.includes("that explains a lot") ||
    main.includes("which tracks");
  const weakOpen =
    /^(you(?:'re| are)\s+(?:a|an)\b)/.test(main) ||
    /^(so\s+you(?:'re| are)\b)/.test(main) ||
    /^(you(?:'re| are)\s+.+,\s+how(?:'s| is)\s+that\b)/.test(main);
  const soundsLikeSummary =
    main.includes("working out for you") ||
    main.includes("you did") ||
    main.includes("the update") ||
    main.includes("today you") ||
    main.includes("applying for") && overlapCount >= 2 && !markerHit;
  const tooLiteral = echoesInputTooLiterally(result.main, text);
  const stitchedQuotes =
    main.includes('"') ||
    main.includes("'") && overlapCount >= 3;
  const shortGenericLiteral =
    isShortGenericTask(text) &&
    (stitchedQuotes || overlapCount >= 2);

  if (main.length < 45) return false;
  if (soundsLikeSummary) return false;
  if (tooLiteral) return false;
  if (shortGenericLiteral) return false;
  if (details.trim() && !detailHit) return false;
  if (stitchedQuotes && !markerHit && !hasComparison && !hasBite) return false;
  if (weakOpen && !markerHit && !hasComparison && !hasBite) return false;

  return (
    markerHit ||
    hasBite ||
    hasComparison ||
    (hasQuestion && hasSecondClause) ||
    (overlapCount >= 2 && hasSecondClause && main.length >= 60) ||
    (overlapCount >= 2 && main.length >= 70)
  );
}

function isSupportiveResult(
  result: { main: string; best: string; worst: string },
  text: string,
  details: string,
  mood: Mood
) {
  const main = tidy(result.main).toLowerCase();
  const combinedInput = `${text} ${details}`.toLowerCase();
  const overlapTerms = Array.from(new Set(tokenize(combinedInput))).slice(0, 10);
  const overlapCount = overlapTerms.filter((term) => main.includes(term)).length;
  const positiveMarkers = [
    "you've got",
    "you can",
    "one step",
    "you deserve",
    "proud",
    "capable",
    "momentum",
    "start",
    "begin",
    "lighter",
    "brave",
    "relief",
    "unstoppable",
    "iconic",
    "spotlight",
    "win",
    "handle this",
    "got this"
  ];
  const negativeMarkers = [
    "embarrassing",
    "idiot",
    "stupid",
    "shame",
    "clown",
    "pathetic",
    "self-awareness is optional",
    "downloadable content",
    "kindly but firmly",
    "you should know that",
    "should know that",
    "be honest",
    "not going to get kinder by waiting"
  ];

  if (main.length < 30) return false;
  if (negativeMarkers.some((marker) => main.includes(marker))) return false;
  if (overlapCount === 0) return false;

  const markerHit = positiveMarkers.some((marker) => main.includes(marker));
  if (mood === "hype") {
    return markerHit || main.includes("legend") || main.includes("main character") || main.includes("moment");
  }

  return markerHit || main.includes("gentle") || main.includes("okay") || main.includes("kind") || main.includes("feel better") || main.includes("you're allowed") || main.includes("one small step");
}

function tidy(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function inferFallbackSituation(text: string, details: string) {
  const combined = `${text} ${details}`.toLowerCase();
  const hasAny = (...terms: string[]) => terms.some((term) => combined.includes(term));

  if (hasAny("rain", "raining", "weather", "bed", "sleep", "tired", "nap")) {
    return {
      label: "weather avoidance",
      behavior: "let mild weather bully your ambition",
      image: "one gray sky and your ambition filed for leave",
      best: "You get up and remember the forecast is not your manager.",
      worst: "A drizzle keeps running your schedule.",
    };
  }

  if (hasAny("email", "inbox", "reply", "respond", "message", "text back", "slack")) {
    return {
      label: "admin dread",
      behavior: "treat one message like sworn testimony",
      image: "one email turned into a federal case in your head",
      best: "You send it and realize it was never that deep.",
      worst: "Your inbox keeps collecting little curses.",
    };
  }

  if (hasAny("apply", "application", "resume", "cv", "cover letter", "job", "interview", "linkedin")) {
    return {
      label: "career avoidance",
      behavior: "let career admin fossilize while calling it timing",
      image: "your applications are aging like archaeological evidence",
      best: "You apply and future-you stops rolling their eyes.",
      worst: "Your opportunities keep expiring in the tabs.",
    };
  }

  if (hasAny("clean", "laundry", "dish", "dishes", "cook", "dinner", "kitchen", "shower", "errand")) {
    return {
      label: "adult task inflation",
      behavior: "turn one normal adult task into a negotiation with destiny",
      image: "you gave one basic responsibility cinematic stakes",
      best: "You do it and the whole thing shrinks back to normal size.",
      worst: "A tiny task keeps acting like your origin story.",
    };
  }

  if (hasAny("call", "hang out", "party", "social", "friend", "date", "people", "meet", "go out")) {
    return {
      label: "social dread",
      behavior: "treat ordinary human contact like a cursed event",
      image: "you approached one social task like it came with thunder",
      best: "You do it and the apocalypse stays cancelled.",
      worst: "You keep acting haunted by normal people.",
    };
  }

  if (hasAny("overthink", "spiral", "thinking", "decide", "decision", "choose", "stuck", "confused")) {
    return {
      label: "overthinking spiral",
      behavior: "polish hesitation until it looks like effort",
      image: "you turned indecision into a full-time craft project",
      best: "You move and the fog loses its job.",
      worst: "You keep workshoping the excuse instead of the task.",
    };
  }

  return {
    label: "generic avoidance",
    behavior: "make one ordinary thing feel weirdly impossible",
    image: "you gave a normal task an unnecessary amount of lore",
    best: "You start and the drama immediately loses funding.",
    worst: "It keeps hanging around like unfinished business.",
  };
}

function rolePhrase(details: string) {
  const role = tidy(details);
  return role ? `${role}` : "grown person on paper";
}

function fallbackFront(mood: Mood, intensity: Intensity, role: string, situation: ReturnType<typeof inferFallbackSituation>) {
  const roastBank: Record<Mood, string[]> = {
    drama: [
      `Breaking news: a ${role} let ${situation.image}.`,
      `Please, a ${role} doing this? ${situation.image}.`,
      `Live footage of a ${role} making ${situation.label} look like prestige television.`,
    ],
    guilt: [
      `For a ${role}, you really do ${situation.behavior}.`,
      `How is a ${role} out here acting like this when ${situation.image}?`,
      `A ${role} should not be losing to this. ${situation.image}.`,
    ],
    hug: [
      `Love you badly, but for a ${role}, this is a lot of drama over one small thing.`,
      `Sweetheart, a ${role} does not need to let ${situation.image}.`,
      `You are a ${role}, baby. We cannot keep letting tiny problems feel mythic.`,
    ],
    doom: [
      `Prophecy says a ${role} let ${situation.image}.`,
      `The omens are humiliating: a ${role} and yet ${situation.image}.`,
      `Balcony report: a ${role} is once again behaving like mild inconvenience is destiny.`,
    ],
    goblin: [
      `Be serious, a ${role} should not be out here letting ${situation.image}.`,
      `Tiny question: why is a ${role} acting like this when the task is barely sentient?`,
      `A ${role} doing this is exactly why the village stopped trusting vibes.`,
    ],
    hype: [
      `You are a ${role}; this is beneath your brand. Go win the tiniest battle imaginable.`,
      `A ${role} like you is one move away from making this look easy.`,
      `You have ${role} energy. Please stop letting small nonsense disrespect the arc.`,
    ],
    nice: [
      `Hey, a ${role} deserves gentler energy than this spiral.`,
      `A ${role} like you does not need to carry this much weight around one small task.`,
      `You are allowed to be a tired ${role} and still start small.`,
    ],
  };

  const line = roastBank[mood][Math.abs(intensity.length + role.length + situation.label.length) % roastBank[mood].length];

  if (mood === "hype" || mood === "nice") {
    return line;
  }

  const punchBank: Record<Intensity, string[]> = {
    soft: [
      situation.image,
      `This is ${situation.label} with excellent branding.`,
    ],
    brutal: [
      situation.image,
      `You make ordinary avoidance sound like a department title.`,
    ],
    unhinged: [
      situation.image,
      `At this point the nonsense has infrastructure.`,
    ],
  };

  const punch = punchBank[intensity][Math.abs(role.length + situation.behavior.length) % punchBank[intensity].length];
  return `${line} ${punch}`;
}

function buildFallbackReceipt(
  text: string,
  details: string,
  mood: Mood,
  intensity: Intensity,
  variationSeed: number
) {
  const role = rolePhrase(details);
  const situation = inferFallbackSituation(text, details);
  const front = fallbackFront(mood, intensity, role, situation);

  const best =
    mood === "hype"
      ? `You move now and look annoyingly correct later.`
      : mood === "nice"
        ? `You start small and feel the whole thing soften.`
        : situation.best;

  const worst =
    mood === "hype"
      ? `You stall and let tiny nonsense disrespect your legend.`
      : mood === "nice"
        ? `You keep carrying it and the dread stays louder than it should.`
        : situation.worst;

  return {
    main: front.slice(0, 220),
    best: best.slice(0, 90),
    worst: worst.slice(0, 90),
  };
}
