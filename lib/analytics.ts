import posthog from 'posthog-js';

export function initAnalytics() {
  if (typeof window === 'undefined') return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

  if (!key) return;

  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
  });
}

// ✅ typed properly
export function track(event: string, props: Record<string, any> = {}) {
  if (typeof window === 'undefined') return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.capture(event, props);
}