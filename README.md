# BrutalCare

A playful Next.js app that roasts you, guilts you (lovingly), hugs you, and predicts your doom.  
**Zero API key required. Zero login. Zero payment. Just vibes.**

## Features

- 🔥 Roast intensity slider: soft → brutal → unhinged
- 🃏 Swipeable 3D response card deck
- 📸 Instagram-story-style share export (local, browser-only)
- 🧠 Memory engine — notices your recurring patterns ("you always do this...")
- 🔥 Streaks / "you survived today" gamification
- 🎨 Mood-based gradient theming
- 🤖 Animated emotional support goblin character

## Setup

```bash
npm install
npm run dev
```

That's it. No `.env` file needed. The app uses **LLM7.io** — a completely free,
no-account, no-key AI API that works straight out of the box.

## Tech

- Next.js 14 (App Router)
- TypeScript
- Framer Motion (swipe deck animations)
- html-to-image (share card export)
- LLM7.io (free AI backend — gpt-4o-mini)
- localStorage (history, streaks, memory — no database)

## Notes

- History, streaks, and memory are localStorage-based — no database required
- Share card export happens entirely in the browser
- Rate limiting is in-memory (resets on restart) — swap for Redis/Upstash in production
- LLM7.io is a public free endpoint; for production with heavy traffic, add your own Groq/OpenRouter key and restore the relevant code in `lib/llm.ts`
