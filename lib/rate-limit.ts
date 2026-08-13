import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult =
  | {
      status: "allowed";
      limit: number;
      remaining: number;
      reset: number;
    }
  | {
      status: "limited";
      limit: number;
      remaining: number;
      reset: number;
    }
  | { status: "unavailable" }
  | { status: "unconfigured" };

function createRateLimiter() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "guilttrip:generate",
    timeout: 1_500,
  });
}

// Keep the client outside the request handler so warm serverless instances can reuse it.
const ratelimit = createRateLimiter();

export async function allowRequest(identifier: string): Promise<RateLimitResult> {
  if (!ratelimit) {
    // Local development remains usable, but production never runs an unprotected endpoint.
    return process.env.NODE_ENV === "production"
      ? { status: "unconfigured" }
      : { status: "allowed", limit: 10, remaining: 10, reset: Date.now() + 60_000 };
  }

  try {
    const result = await ratelimit.limit(identifier);
    if (result.reason === "timeout") {
      console.error("[rate-limit] Upstash request timed out");
      return { status: "unavailable" };
    }

    const metadata = {
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
    return result.success
      ? { status: "allowed", ...metadata }
      : { status: "limited", ...metadata };
  } catch {
    console.error("[rate-limit] Upstash request failed");
    return { status: "unavailable" };
  }
}
