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
  "audacity"
] as const;

function isMood(v: string): v is Mood {
  return ["drama", "guilt", "hug", "doom", "goblin"].includes(v);
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

    const { text, details, memory, mood, intensity } = await req.json();

    if (!text || text.length < 5) {
      return NextResponse.json(
        { error: "type something real." },
        { status: 400 }
      );
    }

    const safeMood: Mood = isMood(mood) ? mood : "guilt";
    const safeIntensity: Intensity = isIntensity(intensity) ? intensity : "brutal";

    const prompt = buildPrompt(text, safeMood, safeIntensity, memory, typeof details === "string" ? details : "");

    const result = await generateReply({ prompt });
    const grounded = isGroundedResult(result, text, typeof details === "string" ? details : "");
    const roasty = isRoastyResult(result, text, typeof details === "string" ? details : "");

    return NextResponse.json(
      grounded && roasty
        ? result
        : buildFallbackReceipt(text, typeof details === "string" ? details : "", safeMood, safeIntensity)
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

function isRoastyResult(
  result: { main: string; best: string; worst: string },
  text: string,
  details: string
) {
  const main = tidy(result.main).toLowerCase();
  const combinedInput = `${text} ${details}`.toLowerCase();
  const overlapTerms = Array.from(new Set(tokenize(combinedInput))).slice(0, 10);
  const overlapCount = overlapTerms.filter((term) => main.includes(term)).length;
  const markerHit = ROAST_MARKERS.some((marker) => main.includes(marker));
  const hasQuestion = main.includes("?");
  const hasSecondClause = /[,;:-]/.test(main);
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

  if (main.length < 45) return false;
  if (soundsLikeSummary) return false;
  if (weakOpen && !markerHit) return false;

  return markerHit || (hasQuestion && hasSecondClause) || (overlapCount >= 2 && hasSecondClause && main.length >= 70);
}

function tidy(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildFallbackReceipt(text: string, details: string, mood: Mood, intensity: Intensity) {
  const task = tidy(text) || "this task";
  const context = tidy(details);
  const taskLine = task.length > 64 ? `${task.slice(0, 64).trim()}...` : task;
  const contextLine = context
    ? context.length > 70
      ? `${context.slice(0, 70).trim()}...`
      : context
    : "";
  const templates: Record<Mood, Record<Intensity, { main: string; best: string; worst: string }>> = {
    drama: {
      soft: {
        main: `"${taskLine}" is still waiting, which is bold for someone whose job is "${contextLine || "apparently avoiding the assignment"}". You really do carry yourself like both the headline and the plot hole.`,
        best: `You do "${taskLine}" and the plot moves.`,
        worst: `"${taskLine}" returns tomorrow for part two.`
      },
      brutal: {
        main: `As a "${contextLine || "full-time excuse curator"}", you are doing amazing work avoiding "${taskLine}". You make one unfinished task feel like a public relations crisis.`,
        best: `You finish "${taskLine}" and look normal again.`,
        worst: `Everyone watches "${taskLine}" drag into tomorrow.`
      },
      unhinged: {
        main: `Live footage confirms "${taskLine}" is still pending while "${contextLine || "your mysterious profession"}" somehow kept you busy. You are the first person I have seen turn a tiny obligation into prestige television.`,
        best: `You kill "${taskLine}" and steal the scene.`,
        worst: `"${taskLine}" gets renewed for another season.`
      }
    },
    guilt: {
      soft: {
        main: `So your title is "${contextLine || "busy for mysterious reasons"}" and yet "${taskLine}" is still sitting there. You make delay sound like a qualified profession.`,
        best: `You do "${taskLine}" and sleep lighter.`,
        worst: `Tomorrow inherits "${taskLine}" too.`
      },
      brutal: {
        main: `You are a "${contextLine || "professional deflector"}" and it shows, because "${taskLine}" still is not done. I can see you are deeply loyal to your current level of effort.`,
        best: `You finish "${taskLine}" and stop embarrassing yourself.`,
        worst: `You carry "${taskLine}" into tomorrow too.`
      },
      unhinged: {
        main: `Please explain how someone with the title "${contextLine || "senior procrastination officer"}" still has "${taskLine}" on layaway. You remind me self-awareness is a subscription service you stopped paying for.`,
        best: `You finally do "${taskLine}" like an adult.`,
        worst: `"${taskLine}" becomes your whole personality.`
      }
    },
    hug: {
      soft: {
        main: `Okay baby, as a "${contextLine || "busy little citizen"}", you are allowed one tiny crisis, not twelve. "${taskLine}" is just standing there waiting for you to stop performing avoidance.`,
        best: `You start "${taskLine}" and feel better.`,
        worst: `"${taskLine}" keeps hovering over your day.`
      },
      brutal: {
        main: `Honey, for a "${contextLine || "fully employed overthinker"}", you are giving "${taskLine}" a lot of unpaid power. You make simple things sound like a hostage negotiation.`,
        best: `You move on "${taskLine}" and the anxiety shrinks.`,
        worst: `"${taskLine}" keeps draining your energy.`
      },
      unhinged: {
        main: `Beloved, as a "${contextLine || "professional feelings manager"}", you cannot keep ghosting "${taskLine}". You cannot heal, journal, or vibe your way out of opening the file.`,
        best: `You do "${taskLine}" and breathe easier.`,
        worst: `You babysit "${taskLine}" all week.`
      }
    },
    doom: {
      soft: {
        main: `The balcony oracle notes that a "${contextLine || "person of mystery"}" still has not touched "${taskLine}". That is how tiny tasks become folklore.`,
        best: `You do "${taskLine}" and dodge the spiral.`,
        worst: `"${taskLine}" cashes out tomorrow.`
      },
      brutal: {
        main: `Prophecy says a "${contextLine || "certified avoider"}" has once again let "${taskLine}" ferment. This is how minor nonsense grows teeth and a LinkedIn profile.`,
        best: `You break the curse and finish "${taskLine}".`,
        worst: `You personally craft fallout around "${taskLine}".`
      },
      unhinged: {
        main: `Prophecy update: even with the title "${contextLine || "mysterious wanderer"}", you are still somehow being haunted by "${taskLine}". The timeline where this resolves itself is fake, sponsored, and deeply unserious.`,
        best: `You interrupt the disaster arc and do "${taskLine}".`,
        worst: `The prophecy around "${taskLine}" gets personal.`
      }
    },
    goblin: {
      soft: {
        main: `Be serious. You are a "${contextLine || "part-time menace"}" and "${taskLine}" is still in witness protection. That is not a workflow. That is chaos with office hours.`,
        best: `You do "${taskLine}" and the goblin calms down.`,
        worst: `The chaos follows "${taskLine}" into tomorrow.`
      },
      brutal: {
        main: `Absolutely not. A "${contextLine || "freelance nonsense dealer"}" still has not finished "${taskLine}". You make simple tasks sound like a luxury import.`,
        best: `You do "${taskLine}" and reclaim your brain.`,
        worst: `You keep marinating while "${taskLine}" waits.`
      },
      unhinged: {
        main: `I have reviewed the crime scene and learned your title is "${contextLine || "chief nonsense architect"}" which frankly tracks, because "${taskLine}" is still untouched. This is clown behavior with calendar access.`,
        best: `You fix "${taskLine}" and earn one crumb of peace.`,
        worst: `Your chaos around "${taskLine}" gets receipts.`
      }
    }
  };

  const picked = templates[mood][intensity];

  return {
    main: picked.main.slice(0, 220),
    best: picked.best.slice(0, 90),
    worst: picked.worst.slice(0, 90),
  };
}
