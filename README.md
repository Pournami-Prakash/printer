# GuiltTrip

### The tiny printer that keeps receipts for your excuses.

You tell it what you have been avoiding.

The printer hums. A goblin checks the evidence. Then, with all the warmth of a concerned friend and the accuracy of an overdue invoice, it prints the truth.

Not a productivity lecture. Not another inspirational quote. Just one painfully specific line, two possible futures, and a small piece of thermal-paper accountability.

## Pick your witness

Every problem deserves the right kind of intervention.

- **Gossip Goblin** turns your avoidance into breaking neighbourhood news.
- **Landlord Goblin** itemizes the emotional late fees.
- **Sweetheart Goblin** offers a hug, then tells the truth anyway.
- **Oracle Goblin** calmly predicts the cursed timeline ahead.
- **Chaos Goblin** meets your mess on its own level.
- **Hype Goblin** announces your comeback before you believe in it.
- **Nice Goblin** gives you the gentler nudge your inner voice forgot.

Choose how hard the truth should land—**Soft**, **Brutal**, or **Unhinged**—and let the machine do the rest.

## What comes out

Each visit becomes a numbered roast ticket containing:

- a personalized verdict shaped by your situation and profession;
- the best timeline, if you finally do the thing;
- the worst timeline, if the excuse wins again;
- a receipt you can save as an image and keep, share, or quietly reconsider.

The printer remembers the last thing you confessed, notices returning visitors through a local streak, and can produce a fresh verdict without simply repeating itself. Its memory stays in the browser.

## Why this exists

Most advice arrives dressed as a checklist. GuiltTrip arrives as a character.

It was built around a small idea: sometimes the distance between avoidance and action is not more information. Sometimes it is being seen—specifically, playfully, and just dramatically enough to make the truth memorable.

The result sits somewhere between a fortune teller, a best friend, and the strange little receipt machine at the back of a convenience store.

## Behind the paper

GuiltTrip is a mobile-first experience built with Next.js, React, TypeScript, Framer Motion, and `html-to-image`.

The response pipeline gives each goblin a distinct voice, adapts it across three intensity levels, and returns a compact verdict with best- and worst-case timelines. Responses are length-limited, checked for unsafe language, and compared with the previous ticket to reduce repetition. Requests also pass through input validation, a bot honeypot, and lightweight rate limiting.

The app can use LLM7 as its no-key response provider or Groq when a key is available. Optional PostHog analytics remain inactive unless configured.

## The fine print

GuiltTrip is playful reflection, not professional medical, mental-health, legal, or financial advice. The goblins are confident; that does not make them licensed.

---

**Confess the task. Choose the goblin. Take the receipt.**
