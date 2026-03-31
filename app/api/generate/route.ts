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

    const { text, details, memory, mood, intensity, variationSeed } = await req.json();

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

    const prompt = buildPrompt(text, safeMood, safeIntensity, memory, finalDetails, finalVariationSeed);

    const result = await getBestReceiptReply(prompt, text, finalDetails);

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

async function getBestReceiptReply(prompt: string, text: string, details: string) {
  const attempts: Array<"groq" | "llm7"> = process.env.GROQ_API_KEY ? ["groq", "llm7"] : ["llm7"];

  for (const provider of attempts) {
    try {
      const result = await generateReply({ prompt, provider });
      const grounded = isGroundedResult(result, text, details);
      const roasty = isRoastyResult(result, text, details);
      if (grounded && roasty) {
        return result;
      }
      console.warn(`[generate] ${provider} returned a weak result`, {
        provider,
        grounded,
        roasty,
        preview: result.main.slice(0, 180),
      });
    } catch (error) {
      console.error(`[generate] ${provider} failed`, error);
      continue;
    }
  }

  return null;
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

  if (main.length < 45) return false;
  if (soundsLikeSummary) return false;
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

function tidy(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildFallbackReceipt(
  text: string,
  details: string,
  mood: Mood,
  intensity: Intensity,
  variationSeed: number
) {
  const task = tidy(text) || "this task";
  const context = tidy(details);
  const taskLine = task.length > 64 ? `${task.slice(0, 64).trim()}...` : task;
  const contextLine = context
    ? context.length > 70
      ? `${context.slice(0, 70).trim()}...`
      : context
    : "";
  const templates: Record<Mood, Record<Intensity, Array<{ main: string; best: string; worst: string }>>> = {
    drama: {
      soft: [
        {
          main: `"${taskLine}" is still waiting, which is bold for someone whose job is "${contextLine || "apparently avoiding the assignment"}". You really do carry yourself like both the headline and the plot hole.`,
          best: `You do "${taskLine}" and the plot moves.`,
          worst: `"${taskLine}" returns tomorrow for part two.`
        },
        {
          main: `I love that as "${contextLine || "someone with mysterious employment"}" you have turned "${taskLine}" into a slow-burning scandal. Even the curtains know too much.`,
          best: `You handle "${taskLine}" and the gossip dies.`,
          worst: `"${taskLine}" becomes episode two.`
        }
      ],
      brutal: [
        {
          main: `As a "${contextLine || "full-time excuse curator"}", you are doing amazing work avoiding "${taskLine}". You make one unfinished task feel like a public relations crisis.`,
          best: `You finish "${taskLine}" and look normal again.`,
          worst: `Everyone watches "${taskLine}" drag into tomorrow.`
        },
        {
          main: `Please, the way "${taskLine}" is still open under the care of a "${contextLine || "professional deflector"}" needs press coverage. You make delay feel red carpet.`,
          best: `You do "${taskLine}" and the scandal cools.`,
          worst: `The mess around "${taskLine}" gets louder.`
        }
      ],
      unhinged: [
        {
          main: `Live footage confirms "${taskLine}" is still pending while "${contextLine || "your mysterious profession"}" somehow kept you busy. You are the first person I have seen turn a tiny obligation into prestige television.`,
          best: `You kill "${taskLine}" and steal the scene.`,
          worst: `"${taskLine}" gets renewed for another season.`
        },
        {
          main: `Breaking news: a "${contextLine || "glorified plot device"}" has once again left "${taskLine}" simmering for ratings. Your avoidance has opening credits.`,
          best: `You wrap "${taskLine}" and roll credits.`,
          worst: `"${taskLine}" enters syndication.`
        }
      ]
    },
    guilt: {
      soft: [
        {
          main: `So your title is "${contextLine || "busy for mysterious reasons"}" and yet "${taskLine}" is still sitting there. You make delay sound like a qualified profession.`,
          best: `You do "${taskLine}" and sleep lighter.`,
          worst: `Tomorrow inherits "${taskLine}" too.`
        },
        {
          main: `Interesting that a "${contextLine || "working citizen"}" has somehow made "${taskLine}" optional. You really do treat responsibilities like community theatre.`,
          best: `You do "${taskLine}" and clear your conscience.`,
          worst: `"${taskLine}" follows you into tomorrow.`
        }
      ],
      brutal: [
        {
          main: `You are a "${contextLine || "professional deflector"}" and it shows, because "${taskLine}" still is not done. I can see you are deeply loyal to your current level of effort.`,
          best: `You finish "${taskLine}" and stop embarrassing yourself.`,
          worst: `You carry "${taskLine}" into tomorrow too.`
        },
        {
          main: `How is a "${contextLine || "paid excuse manufacturer"}" still dodging "${taskLine}" like this? You make ordinary avoidance sound like a leadership role.`,
          best: `You finish "${taskLine}" and act employed.`,
          worst: `"${taskLine}" keeps billing you emotionally.`
        }
      ],
      unhinged: [
        {
          main: `Please explain how someone with the title "${contextLine || "senior procrastination officer"}" still has "${taskLine}" on layaway. You remind me self-awareness is a subscription service you stopped paying for.`,
          best: `You finally do "${taskLine}" like an adult.`,
          worst: `"${taskLine}" becomes your whole personality.`
        },
        {
          main: `A "${contextLine || "chief avoidance strategist"}" still has "${taskLine}" pending? You have the confidence of a person who thinks consequences are a beta feature.`,
          best: `You do "${taskLine}" and rejoin society.`,
          worst: `You and "${taskLine}" become codependent.`
        }
      ]
    },
    hug: {
      soft: [
        {
          main: `Okay baby, as a "${contextLine || "busy little citizen"}", you are allowed one tiny crisis, not twelve. "${taskLine}" is just standing there waiting for you to stop performing avoidance.`,
          best: `You start "${taskLine}" and feel better.`,
          worst: `"${taskLine}" keeps hovering over your day.`
        },
        {
          main: `Sweetheart, for a "${contextLine || "functioning adult on paper"}", you are giving "${taskLine}" so much drama for free. This is a task, not a haunted relic.`,
          best: `You start "${taskLine}" and unclench.`,
          worst: `"${taskLine}" keeps looming overhead.`
        }
      ],
      brutal: [
        {
          main: `Honey, for a "${contextLine || "fully employed overthinker"}", you are giving "${taskLine}" a lot of unpaid power. You make simple things sound like a hostage negotiation.`,
          best: `You move on "${taskLine}" and the anxiety shrinks.`,
          worst: `"${taskLine}" keeps draining your energy.`
        },
        {
          main: `Love you badly, but the way a "${contextLine || "professional spiraler"}" has inflated "${taskLine}" into an emotional hostage situation is almost art.`,
          best: `You do "${taskLine}" and get your peace back.`,
          worst: `You keep romantically suffering over "${taskLine}".`
        }
      ],
      unhinged: [
        {
          main: `Beloved, as a "${contextLine || "professional feelings manager"}", you cannot keep ghosting "${taskLine}". You cannot heal, journal, or vibe your way out of opening the file.`,
          best: `You do "${taskLine}" and breathe easier.`,
          worst: `You babysit "${taskLine}" all week.`
        },
        {
          main: `My darling "${contextLine || "certified overfeeler"}", "${taskLine}" is not going to disappear because you made eye contact with your planner and then had a feeling about it.`,
          best: `You do "${taskLine}" and the curse lifts.`,
          worst: `You parent "${taskLine}" for another week.`
        }
      ]
    },
    doom: {
      soft: [
        {
          main: `The balcony oracle notes that a "${contextLine || "person of mystery"}" still has not touched "${taskLine}". That is how tiny tasks become folklore.`,
          best: `You do "${taskLine}" and dodge the spiral.`,
          worst: `"${taskLine}" cashes out tomorrow.`
        },
        {
          main: `A vision came to me: a "${contextLine || "wandering avoider"}" still circling "${taskLine}" like it might resolve itself. That is how mild inconvenience becomes mythology.`,
          best: `You do "${taskLine}" and the omen quiets.`,
          worst: `"${taskLine}" matures into a problem.`
        }
      ],
      brutal: [
        {
          main: `Prophecy says a "${contextLine || "certified avoider"}" has once again let "${taskLine}" ferment. This is how minor nonsense grows teeth and a LinkedIn profile.`,
          best: `You break the curse and finish "${taskLine}".`,
          worst: `You personally craft fallout around "${taskLine}".`
        },
        {
          main: `The omens are clear: a "${contextLine || "career-grade dodger"}" has once again left "${taskLine}" out to evolve. Congratulations on inventing avoidable doom.`,
          best: `You finish "${taskLine}" and escape the timeline.`,
          worst: `"${taskLine}" develops consequences.`
        }
      ],
      unhinged: [
        {
          main: `Prophecy update: even with the title "${contextLine || "mysterious wanderer"}", you are still somehow being haunted by "${taskLine}". The timeline where this resolves itself is fake, sponsored, and deeply unserious.`,
          best: `You interrupt the disaster arc and do "${taskLine}".`,
          worst: `The prophecy around "${taskLine}" gets personal.`
        },
        {
          main: `The cursed paperwork states that a "${contextLine || "high priest of delay"}" has left "${taskLine}" simmering long enough to become lore. You are being haunted by your own calendar.`,
          best: `You do "${taskLine}" and break the omen.`,
          worst: `"${taskLine}" starts writing your biography.`
        }
      ]
    },
    goblin: {
      soft: [
        {
          main: `Be serious. You are a "${contextLine || "part-time menace"}" and "${taskLine}" is still in witness protection. That is not a workflow. That is chaos with office hours.`,
          best: `You do "${taskLine}" and the goblin calms down.`,
          worst: `The chaos follows "${taskLine}" into tomorrow.`
        },
        {
          main: `Tiny question: why does a "${contextLine || "mild household goblin"}" still have "${taskLine}" hidden under vibes? This is not strategy. This is decorative confusion.`,
          best: `You do "${taskLine}" and peace returns.`,
          worst: `"${taskLine}" joins the mess pile.`
        }
      ],
      brutal: [
        {
          main: `Absolutely not. A "${contextLine || "freelance nonsense dealer"}" still has not finished "${taskLine}". You make simple tasks sound like a luxury import.`,
          best: `You do "${taskLine}" and reclaim your brain.`,
          worst: `You keep marinating while "${taskLine}" waits.`
        },
        {
          main: `A "${contextLine || "licensed chaos goblin"}" still avoiding "${taskLine}" is exactly why the village no longer trusts vibes. You make basic tasks sound rare and expensive.`,
          best: `You handle "${taskLine}" and save face.`,
          worst: `"${taskLine}" keeps rotting on the counter.`
        }
      ],
      unhinged: [
        {
          main: `I have reviewed the crime scene and learned your title is "${contextLine || "chief nonsense architect"}" which frankly tracks, because "${taskLine}" is still untouched. This is clown behavior with calendar access.`,
          best: `You fix "${taskLine}" and earn one crumb of peace.`,
          worst: `Your chaos around "${taskLine}" gets receipts.`
        },
        {
          main: `Inspection complete: a "${contextLine || "full-time goblin executive"}" has once again left "${taskLine}" untouched like it might scare itself away. Your nonsense has infrastructure.`,
          best: `You do "${taskLine}" and regain one molecule of dignity.`,
          worst: `"${taskLine}" becomes a biohazard.`
        }
      ]
    }
  };

  const options = templates[mood][intensity];
  const picked = options[Math.abs(variationSeed) % options.length];

  return {
    main: picked.main.slice(0, 220),
    best: picked.best.slice(0, 90),
    worst: picked.worst.slice(0, 90),
  };
}
